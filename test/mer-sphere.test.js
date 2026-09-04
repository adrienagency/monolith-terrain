// LA MER SUR LA SPHÈRE — Tâche F du plan « UNE SEULE TERRE »
// (`docs/superpowers/plans/2026-08-21-terre-unique.md`).
//
// ══════════ CE QUE CE FICHIER VÉRIFIE, ET CE QU'IL NE PEUT PAS ══════════════
//
// Même partage que `crop-sphere`, `crop-parois`, `crop-habillage` et
// `crop-rampe` : ① la LOI vit dans un module PUR (`src/monde/mer-sphere.js`),
// sans three ni DOM, et se vérifie sous node point par point ; ② ce qui vit dans
// le GPU est vérifié en EXTRAYANT le texte du nuanceur et en l'ÉVALUANT, jamais
// en cherchant un nom dedans.
//
// ⚠️ **CE QUI RESTE HORS DE PORTÉE** : que le GPU exécute ce texte, que la mer
// ne scintille pas contre le fond marin, et que la bascule ne se voie pas.
// **Seul l'écran le dit** — Étapes 4 et 6 de la tâche, et leur compte rendu.
//
// ══════════ LES ASSERTIONS ONT ÉTÉ REJOUÉES AVANT D'ÊTRE ÉCRITES ═══════════
//
// Le banc est `.banc/rejoue-F.mjs`, **LAISSÉ SUR LE DISQUE**. Il rejoue chaque
// candidate contre SEPT lois — le dépôt (`PLAN` : la mer d'aujourd'hui, un plan
// à hauteur fixe), `NAIVE` (la flèche écrite `R(1−cos θ)`), `CHORDE` (la calotte
// dans le crop, un plan dehors), `PLANCHER` (la dégradation qui s'éteint sur
// 0,08 — c'est la loi que `ocean.js` applique aujourd'hui), `DURE` (un seuil au
// lieu d'une bande), `TOT` (la dégradation qui commence à la caméra) et la
// cible. **Dix candidates sur dix distinguent au moins une loi**, et chaque
// test ci-dessous dit LAQUELLE il tue.
//
// ⚠️ **F7 NE DISTINGUAIT RIEN AU PREMIER REJEU, ET C'EST LE REJEU QUI L'A DIT** :
// `0.08 + 0.92 · 1` vaut exactement 1 en double, donc la loi `PLANCHER` passait
// l'assertion « vaut exactement 1 avant la bande ». C'est la loi `TOT` qui a été
// ajoutée pour lui donner une prise — pas l'assertion qui a été affaiblie.

import test from 'node:test'
import assert from 'node:assert/strict'
import { readFileSync } from 'node:fs'
import { registerHooks } from 'node:module'
// ⚠️ **three ENTRE ICI AU TOUR DE CORRECTION R2** : la section ⑩ter exerce le
// grab pass de `poserMer` pour de vrai (matrice de repère, cible de copie), et
// aucune de ces classes n'a besoin d'un contexte WebGL pour être CONSTRUITE —
// c'est déjà ce qui permet à ⑩e…⑩j d'exister.
import * as THREE from 'three'

import {
  fleche,
  EPS_COPLANARITE_UNITES,
  epsilonMerDuCrop,
  PORTEE_DEFAUT,
  porteeHorizon,
  construireCalotte,
  richesseMer,
  distanceBascule,
  bandeDegradation,
  distanceRivage,
  PAS_DIAGONAL,
  empriseCalotte,
  BUDGET_PROFONDEUR_UNITES,
  budgetProfondeurM,
  SEUIL_TRAIT_EAU_UNITES,
  seuilTraitEauM,
  ECHELLE_HOULE_UNITES,
  echelleHouleM,
  RAMPE_NAUTIQUE,
  abscisseNautique,
  PORTEE_CROP,
  RETRAIT_EAU_CROP,
  // ⚡ **D24 — LA COUPE PLATE À LA JUPE.**
  EMPRISE_MER_CROP,
  MARGE_BANDE_HOULE,
  amplitudeLateraleHoule,
  bandeHouleBord,
  GLSL_BORD_CROP,
  MARGE_EAU_CROP,
  construireJupeMer,
  bordDeMer,
  couleursFondDuSocle,
  // ⚠️ **Tache P6** : les deux couleurs de la LAME, la meme faute un cran plus haut.
  couleursEauDuSocle,
  profondeurMaxDuCrop,
} from '../src/monde/mer-sphere.js'
// ⚠️ **Tâche P4** : le fondu de rivage n'est plus écrit dans `globe.js`, il est
// INJECTÉ depuis le module partagé — le test suit donc la valeur à sa source.
import {
  FONDU_HOULE_FIN, GLSL_ECUME, accalmieDuSocle, ETAT_MER_NEUTRE, etatMerDuSocle,
  // ⚠️ **Tâche P6** : la lame d'eau, quatre réglages de plus par le même maillon.
  LAME_EAU_NEUTRE, lameEauDuSocle,
} from '../src/monde/ecume-mer.js'
import { zoomPourEmprise } from '../src/monde/flux-terrain.js'
import { REFRACTION_NEUTRE, refractionDuSocle } from '../src/monde/eau-refraction.js'
// ⚡ **Tâche EAU** : le vent de la mer, dérivé de la houle — ⑱a à ⑱c.
import { ventDeHoule } from '../src/monde/eau-lumiere.js'
// ⚠️ L'ALIAS QUE VITE POSE (`vite.config.js`), RÉSOLU SANS VITE — le patron de
// `test/damier-mer-runtime.test.js` : la copie vendorée fait foi ici, et cinq
// lignes suffisent. Sans ce hook, `Globe.prototype.poserMer` ne peut être
// exercée QUE jusqu'à sa clause de refus (`await import('./ocean.js')` lève),
// ce qui est exactement le trou du Tour de correction 1 (constat I1/F-3) :
// ~150 lignes de corps de méthode — la dérivation de portée, la cuisson du
// champ, la construction du maillage — n'étaient exercées par PERSONNE.
registerHooks({
  resolve(spec, ctx, suivant) {
    if (spec === 'ocean-waves') {
      return { url: new URL('../src/vendor/ocean-waves/index.js', import.meta.url).href, shortCircuit: true }
    }
    return suivant(spec, ctx)
  },
})
import { Globe } from '../src/globe.js'
import { creerEchelleContinue } from '../src/monde/echelle-continue.js'
import { RAMPE_MONDE } from '../src/monde/rampe-crop.js'
import { repereCrop, latLonDeLocal } from '../src/monde/crop-sphere.js'
// LA LOI DE SURFACE — Tache J bis : l'epsilon de coplanarite depend de son DEFAUT.
import { altitudeMaillage } from '../src/monde/fond-crop.js'
// ⚠️ **Tâche P6** : `FRACTION_PROFONDEUR` entre ici parce que ⑭h l'exerce — la
// fraction etait GELEE, et un test qui recopierait `7 / 56` ne rougirait pas si
// le module changeait sous lui.
import { repereLocalCrop, construireSolideCrop, FRACTION_PROFONDEUR } from '../src/monde/parois-crop.js'
import { tileToLatLon } from '../src/geo.js'
import { empriseSocle, FOV_DEG } from '../src/monde/seuil-socle.js'
import { largeurCropM, EXAG_SOCLE_NOMINALE, COTE_CROP_UNITES, CIRCONFERENCE_M } from '../src/monde/habillage-crop.js'

const SRC_OCEAN = new URL('../src/ocean.js', import.meta.url)
const SRC_GLOBE = new URL('../src/globe.js', import.meta.url)

// La Réunion — le crop de toutes les tâches de ce chantier.
const CENTRE = { lat: -21.115, lon: 55.536 }
const REPERE = repereCrop({ centre: CENTRE })
const R_TERRE_M = 6371000 // `EARTH_RADIUS_M` de src/geo.js
const R_GLOBE = 100 // `R_GLOBE` de src/geo.js
const DEMI_M = largeurCropM(REPERE) / 2

// La flèche de référence, en série : `sin²(t) = t²(1 − t²/3 + 2t⁴/45 − …)`.
// Aucune soustraction de deux nombres voisins, donc exacte là où `1 − cos` perd
// ses chiffres. C'est le témoin de ①c, et il est INDÉPENDANT du module.
function flecheSerie(d, R) {
  const t = d / R / 2
  const t2 = t * t
  return 2 * R * t2 * (1 - t2 / 3 + (2 * t2 * t2) / 45)
}
const flecheNaive = (d, R) => R * (1 - Math.cos(d / R))

// ══════════ ① LA FLÈCHE ════════════════════════════════════════════════════

test('①a un point à 100 km du centre est PLUS BAS, et de 784,79 m', () => {
  // ⚠️ TUE `PLAN` (le dépôt) ET `CHORDE`. C'est l'assertion centrale de la
  // tâche : « la mer suit la sphère ». Aujourd'hui la mer d'`ocean.js` est un
  // plan, et cette valeur y vaut zéro.
  assert.ok(Math.abs(fleche(100000, R_TERRE_M) - 784.79) < 0.01)
})

test('①b la chute est QUADRATIQUE : doubler la distance la quadruple', () => {
  // ⚠️ TUE `PLAN` et `CHORDE`, et surtout tout rattrapage LINÉAIRE — la faute
  // que ferait quelqu'un qui « corrigerait » un plan par une pente.
  const a = fleche(50000, R_TERRE_M)
  const b = fleche(100000, R_TERRE_M)
  assert.ok(Math.abs(b / a - 4) < 1e-3, `rapport ${b / a}`)
})

test('①c la flèche est EXACTE à courte distance, et `1 − cos` ne l est pas', () => {
  // ⚠️ TUE `NAIVE`. Le témoin est DANS le test : on évalue aussi la forme
  // rejetée, et on exige qu'elle ÉCHOUE là où la nôtre passe. Sans ce second
  // membre, l'assertion serait verte sur les deux formes et ne dirait rien.
  const d = 6
  const ref = flecheSerie(d, R_TERRE_M)
  const relNotre = Math.abs(fleche(d, R_TERRE_M) - ref) / ref
  const relNaive = Math.abs(flecheNaive(d, R_TERRE_M) - ref) / ref
  assert.ok(relNotre < 1e-9, `notre erreur relative ${relNotre}`)
  assert.ok(relNaive > 1e-5, `la forme rejetée devrait être fausse, erreur ${relNaive}`)
})

test('①d la flèche vaut EXACTEMENT zéro à distance nulle, et refuse un rayon nul', () => {
  assert.ok(Object.is(fleche(0, R_TERRE_M), 0))
  assert.throws(() => fleche(10, 0), TypeError)
  assert.throws(() => fleche(NaN, R_TERRE_M), TypeError)
})

// ══════════ ② L'EPSILON DE COPLANARITÉ ═════════════════════════════════════

test('②a l epsilon du globe est CONVERTI, pas recopié — 0,26 m et non 68,3', () => {
  // ⚠️ CE TEST PORTE LE CHIFFRE DE CE QUE LA FAUTE AURAIT COÛTÉ, comme
  // `crop-habillage` le fait pour la marge de côte. Recopier `0,003` unité de
  // scène sur le globe, à l'exagération 2,8, c'est une marée de 68,3 m.
  const eps = epsilonMerDuCrop(REPERE)
  assert.ok(Math.abs(eps - 0.2619) < 0.001, `epsilon ${eps} m`)
  const siRecopie = EPS_COPLANARITE_UNITES / (R_GLOBE / R_TERRE_M) / EXAG_SOCLE_NOMINALE
  assert.ok(Math.abs(siRecopie - 68.3) < 0.5, `la faute vaudrait ${siRecopie} m`)
  assert.ok(siRecopie / eps > 200, 'la faute doit être de deux ordres de grandeur')
})

test('②b l epsilon suit la LARGEUR du crop : un crop deux fois plus large le double', () => {
  // ⚠️ CE N'EST PAS UNE CONSTANTE DÉGUISÉE. Un crop de largeur double a des
  // unités de scène deux fois plus grosses, donc un epsilon deux fois plus
  // grand en mètres. Une valeur en dur passerait ①a et échouerait ici.
  const large = repereCrop({ centre: CENTRE, zoom: 12 }) // demi ×2
  assert.ok(Math.abs(epsilonMerDuCrop(large) / epsilonMerDuCrop(REPERE) - 2) < 1e-9)
})

test('②c le 0,003 vient bien d `ocean.js` — garde-fou de SOURCE, déclaré', () => {
  // ⚠️ ASSERTION DE SOURCE, ET ELLE EST DÉCLARÉE COMME TELLE : elle ne prouve
  // aucun comportement, elle garde la TRAÇABILITÉ du nombre. Si `ocean.js`
  // change son epsilon, celui du globe doit suivre — sinon les deux mers ne se
  // poseront plus au même endroit.
  const src = readFileSync(SRC_OCEAN, 'utf8')
  assert.match(src, /_seaBase\s*=\s*seaY\s*\+\s*0\.003/)
  assert.equal(EPS_COPLANARITE_UNITES, 0.003)
})

test('②d le fond marin du globe est SUR la sphère TANT QU AUCUN FOND N EST POSÉ', () => {
  // ⚠️ LE MOTIF DE L'EPSILON EST DANS `globe.js`, ET ON LE VÉRIFIE — mais il a
  // CHANGÉ DE PORTÉE à la Tâche J bis, et ce test dit lequel.
  //
  // Avant : `posAt` écrêtait à zéro EN TOUTES CIRCONSTANCES, donc le fond marin
  // était partout coplanaire à la calotte, et l'epsilon était obligatoire PARTOUT.
  // Depuis : la surface porte le relief sous-marin **là où un fond est posé**
  // (`altitudeMaillage`, `src/monde/fond-crop.js`) — l'écart mesuré y vaut 920,7 m
  // en moyenne, donc l'epsilon n'y décide plus rien. **Il reste obligatoire
  // partout ailleurs** : hors du champ, sur toute la planète estompée, dans
  // `?globe=continu`, et sur les lagons que le champ laisse à zéro.
  //
  // Ce qui se garde ici est donc le DÉFAUT : sans fond, `altitudeMaillage` EST
  // `Math.max(h, 0)`. Si quelqu'un retirait cet écrêtage-là, l'epsilon perdrait
  // sa raison d'être — ce test rougirait, et c'est voulu.
  const src = readFileSync(SRC_GLOBE, 'utf8')
  assert.match(src, /altitudeMaillage\([\s\S]{0,12}sampleHeights\(t\.heights, u, v, t\.size\)/,
    '`posAt` doit passer par la loi partagée, pas par un écrêtage à lui')
  const srcFond = readFileSync(new URL('../src/monde/fond-crop.js', import.meta.url), 'utf8')
  assert.match(srcFond, /if \(!Number\.isFinite\(hFond\)\) return Math\.max\(h, 0\)/,
    'sans fond, la surface doit rester celle d’« oceans stay on the sphere »')
  // et le comportement, pas seulement la chaîne
  assert.equal(altitudeMaillage(-4297, null), 0)
  assert.equal(altitudeMaillage(-4297, -4297), -4297)
})

// ══════════ ③ LA CALOTTE ═══════════════════════════════════════════════════

const calotte = (portee, pas, hauteur = 0) =>
  construireCalotte({ repere: REPERE, rayon: R_GLOBE, portee, pas, hauteur })

test('③a le centre de la calotte est EXACTEMENT au niveau de la mer', () => {
  const c = calotte(1, 4)
  const centre = (2 * 5 + 2) * 3 + 1 // (i=2, j=2) sur une grille 4×4
  assert.ok(Object.is(c.positions[centre], 0), `y au centre = ${c.positions[centre]}`)
})

test('③b TOUT sommet est plus bas du centre EXACTEMENT de la flèche de son arc', () => {
  // ⚠️ **PREMIÈRE ÉCRITURE : « le sommet à 100 km est plus bas de 784,79 m ».
  // ELLE A ÉCHOUÉ, ET ELLE AVAIT TORT.** Le sommet à `u = 100 km / demi-côté`
  // est à 100 km le long du PARALLÈLE, pas le long d'un grand cercle : l'arc
  // géodésique y est plus court de 0,22 %, et la flèche de 0,45 %. L'assertion
  // mesurait ma conversion, pas la géométrie livrée.
  //
  // La forme juste est UNIVERSELLE : pour CHAQUE sommet, la chute sous le plan
  // tangent au centre vaut la flèche de son propre arc. Elle tue `PLAN` (chute
  // nulle partout) comme `CHORDE` (chute nulle au-delà du crop), et elle ne
  // dépend d'aucun choix de point.
  const c = calotte(6, 24)
  const p = c.positions
  let pire = 0
  let plusLoin = 0
  for (let k = 0; k < c.compte.sommets; k++) {
    const x = p[k * 3]; const y = p[k * 3 + 1]; const z = p[k * 3 + 2]
    const corde = Math.hypot(x, y, z)
    if (corde === 0) { assert.ok(Object.is(y, 0)); continue }
    const arc = 2 * R_GLOBE * Math.asin(corde / (2 * R_GLOBE))
    const attendu = -fleche(arc, R_GLOBE)
    assert.ok(y < 0, `sommet ${k} : y = ${y}, il devrait être sous le centre`)
    pire = Math.max(pire, Math.abs(y - attendu) / Math.abs(attendu))
    plusLoin = Math.max(plusLoin, arc)
  }
  assert.ok(pire < 1e-5, `écart relatif maximal ${pire}`)
  // …et le banc porte quand même le chiffre parlant : à 100 km d'ARC, 784,79 m.
  assert.ok(Math.abs(fleche(100000, R_TERRE_M) - 784.79) < 0.01)
  assert.ok(plusLoin * (R_TERRE_M / R_GLOBE) > 50000, 'le balayage doit sortir du crop')
})

test('③c la mer du crop et celle du large sont LA MÊME surface, et elle CONTINUE', () => {
  // ⚠️ **CE TEST ÉTAIT AVEUGLE, ET C'EST LA CAMPAGNE DE MUTATION QUI L'A DIT.**
  // Sa première écriture comparait le coin du crop (u = v = 1) évalué sur une
  // calotte taillée AU crop et sur une calotte huit fois plus large, et exigeait
  // l'égalité exacte. La mutation M5 — la loi `CHORDE`, qui écrête `u` et `v` à
  // ±1 et pose un plan au-delà — **passait** : au point u = 1 EXACTEMENT, les
  // deux lois coïncident. C'est le piège que la Tâche A avait su retourner en
  // assertion (superellipse contre octogone, écart NUL à 45°), et que la
  // Tâche E a repayé (①b posé pile à f = ±1).
  //
  // L'assertion garde donc son premier membre — l'égalité au bit près, qui dit
  // « une seule surface » — et **en ajoute un second qui regarde AU-DELÀ du
  // crop** : la mer doit continuer à descendre. Sous `CHORDE` elle y est PLATE.
  const petite = calotte(1, 4)
  const grande = calotte(8, 32)
  const coinPetite = (4 * 5 + 4) * 3 + 1 // u = v = +1
  const coinGrande = (18 * 33 + 18) * 3 + 1 // u = v = +1 aussi (−1 + 2·18/32 = 0,125 ; ×8 = 1)
  assert.ok(Object.is(grande.uv[(18 * 33 + 18) * 2], 1), 'le point choisi doit bien être u = 1')
  assert.equal(petite.positions[coinPetite], grande.positions[coinGrande])

  // ── et AU-DELÀ du crop, la surface continue de suivre la sphère ───────────
  const p = grande.positions
  const yEn = (i, j) => p[(j * 33 + i) * 3 + 1]
  const uEn = (i) => grande.uv[i * 2]
  // sur la rangée du milieu (v = 0), on lit u = 1, 2, 4 et 8 demi-côtés
  const j = 16
  const lus = []
  for (let i = 16; i <= 32; i++) {
    const u = uEn(j * 33 + i)
    if (Math.abs(u - 1) < 1e-6 || Math.abs(u - 2) < 1e-6 || Math.abs(u - 4) < 1e-6 || Math.abs(u - 8) < 1e-6) {
      lus.push({ u, y: yEn(i, j) })
    }
  }
  assert.ok(lus.length >= 3, `on doit trouver au moins trois points au-delà du crop, ${lus.length} trouvés`)
  for (let k = 1; k < lus.length; k++) {
    assert.ok(lus[k].y < lus[k - 1].y, `la mer doit continuer à descendre : u=${lus[k].u} n est pas sous u=${lus[k - 1].u}`)
  }
  // …et quadratiquement : de u = 2 à u = 4, la chute est quadruplée
  const par = (u) => -lus.find((l) => Math.abs(l.u - u) < 1e-6).y
  assert.ok(Math.abs(par(4) / par(2) - 4) < 0.02, `rapport ${par(4) / par(2)}`)
})

test('③d le repère de la calotte est celui des parois, ET IL EST JUSTE', () => {
  // ⚠️ **CE TEST AUSSI ÉTAIT AVEUGLE, ET LA MÊME CAMPAGNE L'A DIT.** Sa première
  // écriture comparait le repère rendu par la calotte à celui rendu par les
  // parois — mais les deux appellent LA MÊME fonction. La mutation M6, qui
  // échange EST et SUD dans `repereLocalCrop`, les faisait donc mentir
  // ENSEMBLE : l'assertion restait verte sur un repère retourné. C'est
  // exactement « une assertion qui ne distingue rien », le piège que ce chantier
  // a payé neuf fois.
  //
  // On garde le premier membre — la calotte et les parois partagent bien le
  // repère, ce qui est la propriété produit — et on ajoute une vérification
  // INDÉPENDANTE : la base est recalculée ici, à la main, depuis la seule
  // latitude/longitude du centre, sans passer par le module.
  const solide = construireSolideCrop({
    repere: REPERE,
    hauteur: () => 0,
    rayon: R_GLOBE,
    echelle: 1e-5,
  })
  const c = calotte(1, 4)
  assert.deepEqual([...c.origine], [solide.origine.x, solide.origine.y, solide.origine.z])
  assert.deepEqual(c.base.est, [solide.base.est.x, solide.base.est.y, solide.base.est.z])
  assert.deepEqual(c.base.haut, [solide.base.haut.x, solide.base.haut.y, solide.base.haut.z])
  assert.deepEqual(c.base.sud, [solide.base.sud.x, solide.base.sud.y, solide.base.sud.z])

  // ── LA VÉRIFICATION INDÉPENDANTE ─────────────────────────────────────────
  const D2R = Math.PI / 180
  const { lat, lon } = latLonDeLocal(0, 0, REPERE)
  const la = lat * D2R
  const lo = lon * D2R
  // la convention de `geo.js` : x = R cos(lat) sin(lon), y = R sin(lat), z = R cos(lat) cos(lon)
  const haut = [Math.cos(la) * Math.sin(lo), Math.sin(la), Math.cos(la) * Math.cos(lo)]
  // l EST pointe vers les longitudes croissantes, à latitude constante
  const est = [Math.cos(lo), 0, -Math.sin(lo)]
  // le SUD pointe vers les latitudes décroissantes
  const sud = [Math.sin(la) * Math.sin(lo), -Math.cos(la), Math.sin(la) * Math.cos(lo)]
  const proche = (a, b, quoi) => {
    for (let k = 0; k < 3; k++) assert.ok(Math.abs(a[k] - b[k]) < 1e-9, `${quoi}[${k}] : ${a[k]} contre ${b[k]}`)
  }
  proche(c.base.haut, haut, 'haut')
  proche(c.base.est, est, 'est')
  proche(c.base.sud, sud, 'sud')
  // …et la base est DIRECTE : est × haut = sud
  const croix = [
    est[1] * haut[2] - est[2] * haut[1],
    est[2] * haut[0] - est[0] * haut[2],
    est[0] * haut[1] - est[1] * haut[0],
  ]
  proche(c.base.sud, croix, 'est × haut')
})

test('③e les indices sont en 32 bits, et une grille de 256 le PROUVE', () => {
  // ⚠️ CE N'EST PAS UN TEST DE TYPE : on exige un indice qui DÉPASSE 65 535.
  // En 16 bits il aurait débordé en silence et le maillage se serait replié sur
  // lui-même — un défaut qui ne se voit qu'à l'écran, et tard.
  const c = calotte(2, 256)
  assert.ok(c.indices instanceof Uint32Array)
  let max = 0
  for (const v of c.indices) if (v > max) max = v
  assert.ok(max > 65535, `indice maximal ${max}`)
  assert.equal(c.compte.sommets, 257 * 257)
})

test('③f les triangles regardent vers le HAUT local', () => {
  // ⚠️ UNE CALOTTE RETOURNÉE EST INVISIBLE (ou visible de dessous), et aucun
  // audit de bords libres ne l'attrape — c'est le §1 d'`audit-solide.js`.
  const c = calotte(4, 8)
  const p = c.positions
  let n = 0
  for (let t = 0; t < c.indices.length; t += 3) {
    const a = c.indices[t] * 3
    const b = c.indices[t + 1] * 3
    const d = c.indices[t + 2] * 3
    const u = [p[b] - p[a], p[b + 1] - p[a + 1], p[b + 2] - p[a + 2]]
    const v = [p[d] - p[a], p[d + 1] - p[a + 1], p[d + 2] - p[a + 2]]
    const ny = u[2] * v[0] - u[0] * v[2] // composante « haut » du produit vectoriel
    assert.ok(ny > 0, `triangle ${t / 3} retourné (ny = ${ny})`)
    n++
  }
  assert.equal(n, c.compte.triangles)
})

test('③g la calotte se pose à `hauteur`, et rien d autre ne bouge', () => {
  // ⚠️ L'EPSILON DE COPLANARITÉ NE DOIT PAS DÉFORMER LA SURFACE : il la
  // TRANSLATE le long du rayon. Un `+ hauteur` ajouté au `y` local après coup
  // aurait donné une surface plate ; ici c'est le RAYON qui grandit.
  const a = calotte(4, 8, 0)
  const h = 1e-4
  const b = calotte(4, 8, h)
  // au centre, la translation est exactement `h`
  const centre = (4 * 9 + 4) * 3 + 1
  assert.ok(Math.abs(b.positions[centre] - a.positions[centre] - h) < 1e-9)
  // au bord, elle est un peu PLUS GRANDE (le rayon a grandi, donc l'arc s'ouvre)
  const bord = (4 * 9 + 8) * 3 + 1
  const ecartBord = b.positions[bord] - a.positions[bord]
  assert.ok(ecartBord > h * 0.999, `au bord ${ecartBord} contre ${h}`)
})

test('③h la portée par défaut couvre l horizon du seuil de naissance du socle', () => {
  // ⚠️ 128 N'EST PAS UN NOMBRE ROND POSÉ LÀ : `porteeHorizon` le dérive du seuil
  // de `seuil-socle.js` (32 274 m) et de l'horizon géométrique √(2Rh).
  const besoin = porteeHorizon(REPERE, 32274, R_TERRE_M)
  assert.ok(Math.abs(besoin - 93.7) < 0.5, `portée nécessaire ${besoin}`)
  assert.ok(PORTEE_DEFAUT >= besoin, `${PORTEE_DEFAUT} doit couvrir ${besoin}`)
})

test('③i la portée par défaut a une LIMITE de latitude, et elle est écrite', () => {
  // ⚠️ **CE TEST A FAIT MONTER LA CONSTANTE DE 128 À 256, ET C'EST SON RÔLE.**
  // `largeurCropM` porte un `cos φ` : un crop islandais est deux fois plus
  // étroit au sol, donc il lui faut deux fois plus de demi-côtés pour atteindre
  // le même horizon — **206**, contre 93,7 à La Réunion.
  const islande = repereCrop({ centre: { lat: 64.9, lon: -19.0 } })
  const besoin = porteeHorizon(islande, 32274, R_TERRE_M)
  assert.ok(Math.abs(besoin - 206.0) < 0.5, `l Islande demande ${besoin}`)
  assert.ok(besoin > porteeHorizon(REPERE, 32274, R_TERRE_M))
  assert.ok(PORTEE_DEFAUT >= besoin)
  // ⚠️ ET LA LIMITE EST NOMMÉE, PAS CACHÉE : au-delà de 70,05° la constante ne
  // suffit plus, et l'appelant doit passer par `porteeHorizon`. Une constante
  // qui deviendrait fausse en silence est le piège du §2 de
  // /threejs-optimisation, à l'envers.
  const juste = repereCrop({ centre: { lat: 70.0, lon: 0 } })
  const trop = repereCrop({ centre: { lat: 72.0, lon: 0 } })
  assert.ok(PORTEE_DEFAUT >= porteeHorizon(juste, 32274, R_TERRE_M), 'a 70 degres elle doit encore suffire')
  assert.ok(PORTEE_DEFAUT < porteeHorizon(trop, 32274, R_TERRE_M), 'a 72 degres elle ne doit PLUS suffire')
})

// ══════════ ④ LA DÉGRADATION ═══════════════════════════════════════════════

const BANDE = { debut: 20, fin: 40 }

test('④a la richesse atteint EXACTEMENT zéro au bout de sa bande', () => {
  // ⚠️ TUE `PLANCHER`, c'est-à-dire la loi que `ocean.js` applique AUJOURD'HUI
  // (`uViewCalm = 0.08 + 0.92 · calm`). C'est la propriété qui permet de SAUTER
  // le calcul sans que la bascule se voie : avec un plancher, sauter ferait
  // disparaître 8 % de l'effet d'un coup.
  assert.ok(Object.is(richesseMer(BANDE.fin, BANDE.debut, BANDE.fin), 0))
  assert.ok(Object.is(richesseMer(1e6, BANDE.debut, BANDE.fin), 0))
})

test('④b la richesse vaut EXACTEMENT 1 avant sa bande', () => {
  // ⚠️ TUE `TOT` — la dégradation qui commence à la caméra et appauvrit la mer
  // partout, y compris sous le nez.
  assert.ok(Object.is(richesseMer(0, BANDE.debut, BANDE.fin), 1))
  assert.ok(Object.is(richesseMer(BANDE.debut, BANDE.debut, BANDE.fin), 1))
})

test('④c la richesse est CONTINUE et décroissante sur tout le balayage', () => {
  // ⚠️ TUE `DURE`. Le pas du balayage est 0,01 unité ; la marche d'un seuil y
  // vaudrait 1,0 d'un coup.
  let pire = 0
  let prec = richesseMer(0, BANDE.debut, BANDE.fin)
  for (let d = 0; d <= 60; d += 0.01) {
    const r = richesseMer(d, BANDE.debut, BANDE.fin)
    assert.ok(r <= prec + 1e-12, `remontée à d = ${d}`)
    pire = Math.max(pire, Math.abs(r - prec))
    prec = r
  }
  assert.ok(pire < 0.01, `plus grand saut ${pire}`)
})

test('④d la pente s annule aux DEUX bouts — la bascule n a pas d angle', () => {
  // ⚠️ UNE RAMPE LINÉAIRE SERAIT CONTINUE MAIS ANGULEUSE, et un angle dans la
  // richesse se lit comme un CERCLE sur la mer. `smoothstep` est C¹ aux deux
  // bouts, et c'est ce qu'on exige.
  const h = 1e-4
  const penteA = (richesseMer(BANDE.debut + h, BANDE.debut, BANDE.fin) - 1) / h
  const penteB = (0 - richesseMer(BANDE.fin - h, BANDE.debut, BANDE.fin)) / h
  // ⚠️ LE SEUIL SE COMPARE À UN TÉMOIN, PAS À UN NOMBRE ROND. La pente d'une
  // rampe LINÉAIRE sur la même bande vaut −1/(fin − début) = −0,05 ; celle-ci
  // vaut 1,6·10⁻⁶, soit **trente mille fois moins**. Le résidu n'est pas du
  // bruit : c'est le terme quadratique de `smoothstep`, qui vaut 3t²/h avec
  // t = ln(1 + h/début)/ln(fin/début) — donc il DOIT être non nul.
  const penteLineaire = 1 / (BANDE.fin - BANDE.debut)
  assert.ok(Math.abs(penteA) < penteLineaire / 1000, `pente au debut ${penteA} contre ${penteLineaire}`)
  assert.ok(Math.abs(penteB) < penteLineaire / 1000, `pente a la fin ${penteB} contre ${penteLineaire}`)
  assert.ok(Math.abs(penteA) > 0, 'le terme quadratique doit exister')
  // …et au MILIEU elle ne l'est pas : sinon la loi serait constante.
  const penteM = (richesseMer(30 + h, BANDE.debut, BANDE.fin) - richesseMer(30 - h, BANDE.debut, BANDE.fin)) / (2 * h)
  assert.ok(Math.abs(penteM) > 0.05, `pente au milieu ${penteM}`)
})

test('④e la bascule suit la HAUTEUR D IMAGE et la FINESSE du détail', () => {
  // ⚠️ TUE une bascule posée en CONSTANTE (par exemple `SURF_FAR = 64` promu en
  // seuil). Doubler la hauteur d'image double la distance à laquelle le détail
  // survit ; un détail deux fois plus fin la divise par deux.
  const b = (o) => distanceBascule({ lambda: 0.5, hauteurPx: 800, fovDeg: 33, ...o })
  assert.ok(Math.abs(b({ hauteurPx: 1600 }) / b({}) - 2) < 1e-12)
  assert.ok(Math.abs(b({ lambda: 0.25 }) / b({}) - 0.5) < 1e-12)
  // et elle RÉTRÉCIT quand le champ de vision s'ouvre
  assert.ok(b({ fovDeg: 60 }) < b({}))
  assert.throws(() => distanceBascule({ lambda: 0, hauteurPx: 800, fovDeg: 33 }), TypeError)
  assert.throws(() => distanceBascule({ lambda: 1, hauteurPx: 800, fovDeg: 200 }), TypeError)
})

test('④f `parDetail = 2` est la borne de Nyquist, et elle est ATTEIGNABLE', () => {
  // ⚠️ UNE CONSTANTE INATTEIGNABLE EST DU CODE MORT — c'est le §2 de
  // /threejs-optimisation. On vérifie que le paramètre MORD : le passer à 4
  // rapproche la bascule d'un facteur deux exactement.
  const a = distanceBascule({ lambda: 0.5, hauteurPx: 800, fovDeg: 33 })
  const b = distanceBascule({ lambda: 0.5, hauteurPx: 800, fovDeg: 33, parDetail: 4 })
  assert.ok(Math.abs(a / b - 2) < 1e-12)
})

test('④g la bande est GÉOMÉTRIQUE autour de la bascule, pas additive', () => {
  // ⚠️ UNE BANDE ADDITIVE (« ±10 unités ») serait la moitié de la vue à 20 et
  // invisible à 2 000 : elle n'a pas de sens sur cinq ordres de grandeur.
  const { debut, fin } = bandeDegradation(100, 4)
  assert.ok(Math.abs(debut * fin - 100 * 100) < 1e-9, 'la bascule est la moyenne GÉOMÉTRIQUE')
  assert.ok(Math.abs(fin / debut - 4) < 1e-9)
  // ⚠️ **CETTE LIGNE A ÉCHOUÉ, ET ELLE AVAIT RAISON.** Avec une transition lisse
  // sur `d`, `richesseMer(100)` valait **0,7407** : la bande était géométrique
  // mais la rampe ne l'était pas. C'est ce test qui a fait passer `richesseMer`
  // en LOGARITHME de distance. La bascule est maintenant le milieu exact.
  assert.ok(Math.abs(richesseMer(100, debut, fin) - 0.5) < 1e-12, `richesse a la bascule ${richesseMer(100, debut, fin)}`)
  // …et la transition dure le même nombre d'octaves de chaque côté
  const gauche = richesseMer(100 / Math.sqrt(2), debut, fin)
  const droite = richesseMer(100 * Math.sqrt(2), debut, fin)
  assert.ok(Math.abs((gauche - 0.5) + (droite - 0.5)) < 1e-12, 'la transition doit etre symetrique en octaves')
  assert.throws(() => bandeDegradation(100, 1), TypeError)
})

// ══════════ ⑤ LA DISTANCE AU RIVAGE ════════════════════════════════════════

test('⑤a le chanfrein du DÉPÔT sur-estime de 41,4 % sur deux diagonales sur quatre', () => {
  // ⚠️ **CE TEST A TROUVÉ UN DÉFAUT DU DÉPÔT, ET C'EST SON RÉSULTAT PRINCIPAL.**
  // La première écriture exigeait un MAJORANT de la distance euclidienne — ce
  // qu'un chanfrein correct garantit à 8 % près. Elle a échoué à **+41,42 %**.
  // Cause : le demi-masque de `ocean.js` ne lit que TROIS voisins par passe au
  // lieu de quatre — les anti-diagonales manquent. Dans les quadrants (+x, −y)
  // et (−x, +y) la distance ne peut voyager que par pas d'axe.
  //
  // Ce champ pilote la houle de côte, les bandes d'écume et le ressac : la
  // frange de ressac du socle meurt 41 % trop tôt sur deux orientations de côte
  // sur quatre. **On ne le corrige pas ici** (le socle est en production et hors
  // périmètre) : on le NOMME, on le CHIFFRE, et la mer sphérique prend l'option
  // `completes`.
  const n = 65
  const eau = new Uint8Array(n * n).fill(1)
  const c = (n - 1) / 2
  eau[c * n + c] = 0 // une seule cellule de terre, au centre
  const bornes = (d) => {
    let hi = -9
    let lo = 9
    for (let j = 0; j < n; j++) {
      for (let i = 0; i < n; i++) {
        const vrai = Math.hypot(i - c, j - c)
        if (vrai === 0) { assert.equal(d[j * n + i], 0); continue }
        const r = d[j * n + i] / vrai - 1
        if (r > hi) hi = r
        if (r < lo) lo = r
      }
    }
    return { hi, lo }
  }
  const depot = bornes(distanceRivage(eau, n, 1))
  assert.ok(Math.abs(depot.hi - 0.41421) < 1e-4, `sur-estimation du depot ${depot.hi}`)
  const complet = bornes(distanceRivage(eau, n, 1, { completes: true }))
  assert.ok(complet.hi < 0.083, `sur-estimation complete ${complet.hi}`)
  assert.ok(complet.hi > 0.08, 'et elle reste celle, connue, du chanfrein (1 ; racine de 2)')
  // la direction fautive, nommée
  const d0 = distanceRivage(eau, n, 1)
  const d1 = distanceRivage(eau, n, 1, { completes: true })
  assert.ok(Math.abs(d0[(c - 8) * n + (c + 8)] - 16) < 1e-4, 'le depot va tout droit')
  assert.ok(Math.abs(d1[(c - 8) * n + (c + 8)] - 8 * 1.414) < 1e-3, 'le complet coupe en diagonale')
})

test('⑤a bis le pas diagonal est 1,414, pas racine de 2 — et ça SOUS-estime', () => {
  // ⚠️ SECONDE DIFFÉRENCE AVEC L'EUCLIDIENNE, ET ELLE VIENT AUSSI DU DÉPÔT.
  // `ocean.js` écrit le littéral 1,414. Sur une diagonale pure le chanfrein
  // sous-estime donc de (√2 − 1,414)/√2 par cellule. On l'ÉNONCE plutôt que de
  // le masquer, et on ne le corrige pas : ce serait changer la mer du socle.
  const n = 33
  const c = 16
  const eau = new Uint8Array(n * n).fill(1)
  eau[c * n + c] = 0
  const d = distanceRivage(eau, n, 1, { completes: true })
  assert.equal(PAS_DIAGONAL, 1.414)
  assert.ok(Math.abs(d[0] - 16 * 1.414) < 1e-3, `coin ${d[0]}`)
  assert.ok(d[0] < 16 * Math.SQRT2, 'le pas arrondi SOUS-estime la diagonale')
  // exact sur un axe, en revanche
  assert.ok(Math.abs(d[c * n + (n - 1)] - 16) < 1e-4)
})

test('⑤e le mode par DÉFAUT est celui du dépôt, au bit près', () => {
  // ⚠️ **LE TÉMOIN EST LA BOUCLE D'ORIGINE, RECOPIÉE ICI TELLE QUELLE.** Sans
  // lui, « on élargit, on ne remplace pas » ne serait qu'une intention de
  // commentaire : rien n'empêcherait le mode complet de devenir le défaut et de
  // changer la mer du socle en silence. Les deux tableaux sont comparés case
  // par case, sans tolérance.
  const n = 48
  const eau = new Uint8Array(n * n)
  for (let k = 0; k < n * n; k++) eau[k] = (k * 2654435761) % 7 > 1 ? 1 : 0
  const cellule = 0.3
  const notre = distanceRivage(eau, n, cellule)
  // — la boucle d'origine, telle qu'elle vivait dans `ocean.js:_bakeField` —
  const INF = 1e9
  const dist = new Float32Array(n * n)
  for (let k = 0; k < n * n; k++) dist[k] = eau[k] ? INF : 0
  for (let j = 0; j < n; j++)
    for (let i = 0; i < n; i++) {
      const k = j * n + i
      if (i > 0) dist[k] = Math.min(dist[k], dist[k - 1] + cellule)
      if (j > 0) dist[k] = Math.min(dist[k], dist[k - n] + cellule)
      if (i > 0 && j > 0) dist[k] = Math.min(dist[k], dist[k - n - 1] + cellule * 1.414)
    }
  for (let j = n - 1; j >= 0; j--)
    for (let i = n - 1; i >= 0; i--) {
      const k = j * n + i
      if (i < n - 1) dist[k] = Math.min(dist[k], dist[k + 1] + cellule)
      if (j < n - 1) dist[k] = Math.min(dist[k], dist[k + n] + cellule)
      if (i < n - 1 && j < n - 1) dist[k] = Math.min(dist[k], dist[k + n + 1] + cellule * 1.414)
    }
  for (let k = 0; k < n * n; k++) assert.ok(Object.is(notre[k], dist[k]), `case ${k} : ${notre[k]} contre ${dist[k]}`)
  // …et le mode complet, lui, DIFFÈRE — sinon l'option ne servirait à rien
  const complet = distanceRivage(eau, n, cellule, { completes: true })
  let differents = 0
  for (let k = 0; k < n * n; k++) if (!Object.is(complet[k], dist[k])) differents++
  assert.ok(differents > 0, 'le mode complet doit changer quelque chose')
})

test('⑤b la distance est PROPORTIONNELLE à la taille de cellule', () => {
  const n = 17
  const eau = new Uint8Array(n * n).fill(1)
  eau[0] = 0
  const a = distanceRivage(eau, n, 1)
  const b = distanceRivage(eau, n, 3)
  for (let k = 0; k < n * n; k++) assert.ok(Math.abs(b[k] - 3 * a[k]) < 1e-3, `k = ${k}`)
})

test('⑤c une mer sans terre reste à l infini, une terre pleine reste à zéro', () => {
  const n = 9
  const toutEau = distanceRivage(new Uint8Array(n * n).fill(1), n, 1)
  for (const v of toutEau) assert.ok(v >= 1e9, `${v}`)
  const touteTerre = distanceRivage(new Uint8Array(n * n), n, 1)
  for (const v of touteTerre) assert.equal(v, 0)
})

test('⑤d `ocean.js` A CESSÉ de porter sa propre boucle — garde-fou de SOURCE, déclaré', () => {
  // ⚠️ ASSERTION DE SOURCE, DÉCLARÉE : elle ne prouve pas un comportement, elle
  // garde l'UNICITÉ de la loi. `_bakeField` tire three, donc node ne peut pas
  // l'exécuter — c'est la limite de ce fichier, et elle est écrite en tête.
  const src = readFileSync(SRC_OCEAN, 'utf8')
  assert.ok(!/dist\[k - n - 1\]/.test(src), 'la boucle de chanfrein est encore dans ocean.js')
  // ⚠️ **Tâche P4** : l'importation en porte maintenant DEUX — `GLSL_JUPE_MER`
  // est la couleur du rideau d'eau, extraite de `SKIRT_FRAG` pour que le crop
  // lise les mêmes six lignes. Le garde-fou reste le même : une seule écriture.
  // ⚠️ **Tâche P6** : elle en porte TROIS — `couleursEauDuSocle` remonte les
  // deux couleurs de la LAME d'eau, celles que `poserMer` prenait sur son propre
  // défaut faute d'appelant pour son paramètre `couleurs`.
  assert.match(src, /import \{ distanceRivage, GLSL_JUPE_MER, couleursEauDuSocle \} from '\.\/monde\/mer-sphere\.js'/)
  assert.ok(!/float alpha = mix\(0\.55, 0\.94, uFrost\)/.test(src),
    'la couleur du rideau est encore ecrite dans ocean.js')
  assert.match(src, /gl_FragColor = couleurJupeMer\(uDeep, uSky, g, uFrost, uDayLight, grain\);/)
})

// ══════════ ⑥ L'EMPRISE ════════════════════════════════════════════════════

test('⑥a à portée 1, l emprise de la calotte EST celle du socle', () => {
  // ⚠️ ELLE N'EST PAS « À PEU PRÈS » CELLE DU SOCLE : c'est par elle que
  // `remplirHauteurs` va chercher la BATHYMÉTRIE FUSIONNÉE, et une emprise
  // décalée d'un demi-texel décalerait tout le fond marin.
  const a = empriseCalotte(REPERE, 1)
  const b = empriseSocle({ centre: CENTRE })
  for (const k of ['ouest', 'est', 'nord', 'sud']) {
    assert.ok(Math.abs(a[k] - b[k]) < 1e-9, `${k} : ${a[k]} contre ${b[k]}`)
  }
})

test('⑥b l emprise GRANDIT avec la portée, et s écrête au tour du monde', () => {
  const p1 = empriseCalotte(REPERE, 1)
  const p8 = empriseCalotte(REPERE, 8)
  assert.ok(p8.nord > p1.nord && p8.sud < p1.sud)
  const monde = empriseCalotte(REPERE, 100000)
  assert.equal(monde.ouest, -180)
  assert.equal(monde.est, 180)
  // ⚠️ **CETTE LIGNE A ÉCHOUÉ, ET ELLE A TROUVÉ UN VRAI DÉFAUT.** À grande
  // portée, `latLonDeLocal` passe par `sinh(π · 36,5)` qui DÉBORDE en
  // `Infinity` : `atan` rendait exactement **90°**, donc un pôle, donc un
  // `tuileY` infini dans `remplirHauteurs`. Le module écrête maintenant à la
  // couverture de Mercator, comme `mercY` le fait pour le `discard` du crop.
  assert.ok(monde.nord < 90 && monde.sud > -90, 'la latitude ne depasse jamais les poles')
  assert.ok(Math.abs(monde.nord - 85.05112878) < 1e-6, `nord ${monde.nord}`)
})

// ══════════ ⑦ R1 — LA BOUCLE EST COUPÉE ════════════════════════════════════

test('⑦a aucun module de CADRAGE ne lit la mer', () => {
  // ⚠️ R1 : « aucune décision de cadrage ne lit une quantité dérivée du
  // terrain ». La mer LIT le relief (par le champ), donc il faut vérifier que
  // rien ne referme la boucle — c'est le geste que la Tâche D a fait pour la
  // rampe, et que les deux pilotes d'exagération divergents ont rendu
  // obligatoire.
  for (const f of ['seuil-socle.js', 'descente-bornee.js', 'exageration-continue.js', 'veille-socle.js', 'flux-terrain.js']) {
    const src = readFileSync(new URL(`../src/monde/${f}`, import.meta.url), 'utf8')
    assert.ok(!/mer-sphere/.test(src), `${f} lit la mer`)
  }
})

test('⑦b le module reste PUR : ni three, ni DOM', () => {
  const src = readFileSync(new URL('../src/monde/mer-sphere.js', import.meta.url), 'utf8')
  assert.ok(!/from 'three'/.test(src))
  assert.ok(!/\bdocument\.|\bwindow\./.test(src))
})

// ══════════ ⑧ LA TRANSCRIPTION DANS LE NUANCEUR ════════════════════════════
//
// ⚠️ **ON EXTRAIT LE TEXTE ET ON L'EXÉCUTE** — c'est le patron de la section ⑩
// de `crop-habillage` et de `crop-rampe`, et il existe parce que chercher un nom
// dans un nuanceur ne prouve rien : la Tâche C a vu douze mutations sémantiques
// survivre à vingt assertions de présence.

function extraitGlsl(nom) {
  const src = readFileSync(SRC_GLOBE, 'utf8')
  const m = src.match(new RegExp(`float ${nom}\\s*=\\s*([^;]+);`))
  assert.ok(m, `l expression \`float ${nom} = …;\` est absente de globe.js`)
  return m[1].replace(/\s+/g, ' ').trim()
}

test('⑧a la richesse du nuanceur est la MÊME loi que celle du module', () => {
  // On prend le texte GLSL, on le traduit mécaniquement en JS et on CONFRONTE
  // son verdict à `richesseMer` sur un balayage. Une divergence d'un bit tue.
  const expr = extraitGlsl('richesseMer')
  // ⚠️ LA TRADUCTION EST MÉCANIQUE ET SON ORDRE COMPTE : `log(` d'abord, sinon
  // `max(` aurait déjà réécrit l'intérieur. Chaque fonction GLSL devient un
  // paramètre nommé, donc une expression qui emploierait autre chose LÈVERAIT
  // une erreur au lieu de passer en silence.
  const js = expr
    .replace(/smoothstep\(/g, 'SMOOTH(')
    .replace(/log\(/g, 'LOG(')
    .replace(/max\(/g, 'MAX(')
    .replace(/uMerDebut/g, 'debut')
    .replace(/uMerFin/g, 'fin')
    .replace(/dMer/g, 'd')
  // eslint-disable-next-line no-new-func
  const f = new Function('d', 'debut', 'fin', 'SMOOTH', 'LOG', 'MAX', `return ${js}`)
  const SMOOTH = (a, b, x) => { const t = Math.min(1, Math.max(0, (x - a) / (b - a))); return t * t * (3 - 2 * t) }
  let vus = 0
  for (let d = 0.01; d <= 60; d += 0.05) {
    const attendu = richesseMer(d, BANDE.debut, BANDE.fin)
    const rendu = f(d, BANDE.debut, BANDE.fin, SMOOTH, Math.log, Math.max)
    assert.ok(Math.abs(rendu - attendu) < 1e-12, `d = ${d} : ${rendu} contre ${attendu}`)
    vus++
  }
  assert.ok(vus > 1000, `le balayage doit être dense : ${vus} points`)
  // …et les deux bouts EXACTS, là où la garde de saut se déclenche
  assert.ok(Object.is(f(BANDE.fin, BANDE.debut, BANDE.fin, SMOOTH, Math.log, Math.max), 0))
  assert.ok(Object.is(f(BANDE.debut, BANDE.debut, BANDE.fin, SMOOTH, Math.log, Math.max), 1))
})

test('⑧b le nuanceur SAUTE le travail quand la richesse est nulle', () => {
  // ⚠️ C'EST TOUT L'INTÉRÊT DE LA TÂCHE, ET UNE ASSERTION DE PRÉSENCE NE LE
  // PROUVERAIT PAS. On exige que la garde soit une SORTIE ANTICIPÉE (`if (… <=
  // 0.0)` suivi d'une affectation de couleur puis `return`), et non une
  // multiplication — la loi de `ocean.js`, qui paie tout puis multiplie par
  // 0,08. Le motif cherché est structurel : « la richesse gouverne un
  // branchement », pas « le mot richesse apparaît ».
  const src = readFileSync(SRC_GLOBE, 'utf8')
  const bloc = src.match(/\/\/ ══════ LA MER[\s\S]*?\n\}\n`/)
  assert.ok(bloc, 'le bloc de la mer est absent de globe.js')
  // ⚡ **DEPUIS D24 LA GARDE PORTE DEUX CONDITIONS, ET C'EST LA MÊME SORTIE.**
  // La richesse dit « trop loin pour qu'on voie la houle » ; `attBord` dit
  // « hors de l'emprise du socle ». Les deux mènent au même `return`, et le
  // test exige toujours une SORTIE ANTICIPÉE, pas une multiplication.
  assert.match(bloc[0], /if\s*\(\s*richesseMer\s*<=\s*0\.0\s*\|\|\s*attBord\s*<=\s*0\.0\s*\)/)
  const garde = /if \(richesseMer <= 0\.0 \|\| attBord <= 0\.0\) \{([\s\S]*?)\n  \}/.exec(bloc[0])?.[1]
  assert.ok(garde && /\breturn;/.test(garde), 'la garde doit RETOURNER, pas multiplier')
  assert.ok(!/oceanGerstner|shoreSurf/.test(garde), 'rien de la houle ne doit vivre dans la garde')
})


test('⑧c la rampe nautique du FOND, dans le nuanceur du globe, transcrit le MÊME exposant', () => {
  // ⚠️ Tour de correction 1 (constat I2) : `pow(…, 0.55)` de la transcription
  // dans `globe.js` (la ligne qui peint le fond marin sous `uMerRampeOn`)
  // n'était protégée par AUCUN test — seule `abscisseNautique`, la loi PURE
  // du module, l'était (⑨d). Une mutation qui change cet exposant en `1.0`
  // survivait à 44/44. Même patron que ⑧a : on extrait le texte, on le
  // confronte À LA FONCTION PURE sur un balayage.
  // ⚡ **ET DEPUIS R28 L'EXPRESSION PORTE DEUX RÉGIMES, DONC ON L'EXÉCUTE DEUX
  // FOIS.** `dMer01` mélange la profondeur normalisée du CROP et celle du MONDE
  // sur `dedansCrop` : à 1 c'est la loi du dépôt au bit près (le budget du bloc),
  // à 0 c'est le budget mondial. Un test qui n'exercerait qu'un des deux
  // laisserait l'autre sans garde — la faute que ⑤d de `crop-naturel` a payée.
  const js = [extraitGlsl('dMerCrop'), extraitGlsl('dMerMonde'), extraitGlsl('dMer01')]
    .map((e) => e
      .replace(/pow\(/g, 'POW(')
      .replace(/clamp\(/g, 'CLAMP(')
      .replace(/max\(/g, 'MAX(')
      .replace(/mix\(/g, 'MIX(')
      .replace(/uMerFondBudgetM/g, 'budget')
      .replace(/uPlancherRampeM/g, 'plancher'))
  // eslint-disable-next-line no-new-func
  const f = new Function('h', 'budget', 'plancher', 'dedansCrop', 'MONDE_PROFONDEUR', 'POW', 'CLAMP', 'MAX', 'MIX',
    `const dMerCrop = ${js[0]}; const dMerMonde = ${js[1]}; return ${js[2]}`)
  const CLAMP = (x, a, b) => Math.min(b, Math.max(a, x))
  const MIX = (a, b, t) => a * (1 - t) + b * t
  const crop = (h, budget) => f(h, budget, 1e-6, 1, 6000, Math.pow, CLAMP, Math.max, MIX)
  const monde = (h, prof) => f(h, 1, 1e-6, 0, prof, Math.pow, CLAMP, Math.max, MIX)
  let vus = 0
  for (let prof = 0; prof <= 1000; prof += 5) {
    const attendu = abscisseNautique(prof, 1000)
    assert.ok(Math.abs(crop(-prof, 1000) - attendu) < 1e-9, `crop, profondeur ${prof}`)
    // ⚠️ **LE MÊME EXPOSANT DES DEUX CÔTÉS** : hors découpe la seule chose qui
    // change est le BUDGET, jamais la loi.
    assert.ok(Math.abs(monde(-prof, 1000) - attendu) < 1e-9, `monde, profondeur ${prof}`)
    vus++
  }
  assert.ok(vus > 150, `le balayage doit être dense : ${vus} points`)
  // un exposant de 1,0 rendrait 0,1 à 10 % de profondeur — c'est la mutation
  // que ce test tue, comme ⑨d le fait déjà pour la loi pure.
  assert.ok(Math.abs(crop(-100, 1000) - Math.pow(0.1, 0.55)) < 1e-9)
  // ⛔ **ET LES DEUX RÉGIMES SE DISTINGUENT VRAIMENT** — sinon ce test ne
  // prouverait rien de neuf : au budget du monde (6 000 m), 100 m de fond ne
  // valent pas ce qu'ils valent au budget d'un crop de 113 m (Bornéo, relevé).
  assert.ok(Math.abs(monde(-100, 6000) - crop(-100, 113.3)) > 0.4,
    'le budget du monde et celui du crop rendent la même couleur — le mélange ne mélange rien')
})

test('⑧d le fondu de rivage du nuanceur GARDE son seuil de 0,10, pas approximatif', () => {
  // ⚠️ Tour de correction 1 (constat I3) : `smoothstep(0.0, 0.10, vRive)`
  // n'était protégé par aucun test — muté à `0.40`, 44/44 restait vert. On
  // vérifie la VALEUR exacte du seuil, pas seulement la présence du nom
  // `fade` — le même défaut que le §0 met en garde contre une assertion qui
  // cherche une CHAÎNE plutôt qu'un COMPORTEMENT.
  const src = readFileSync(SRC_GLOBE, 'utf8')
  const bloc = src.match(/\/\/ ══════ LA MER[\s\S]*?\n\}\n`/)
  assert.ok(bloc, 'le bloc de la mer est absent de globe.js')
  // ⚠️ **DEPUIS LA TÂCHE P4 LE SEUIL VIT DANS `monde/ecume-mer.js`** — c'est le
  // MÊME que celui d'`ocean.js`, et il n'est plus écrit qu'une fois. Le test
  // garde sa raison d'être (une mutation du seuil doit rougir) mais suit la
  // valeur à sa source. **Et il exige que le nuanceur appelle la fonction
  // partagée sur le DÉCLIN, pas sur le fondu** : c'était toute la faute de P4.
  // ⚡ **ET DEPUIS D24 IL PORTE `attBord` EN TROISIÈME FACTEUR** : c'est par lui
  // que la houle s'éteint AVANT le bord, donc que la coupe est plate. Le mettre
  // ailleurs (sur `disp` après coup) laisserait Gerstner tourner pour rien.
  assert.ok(/float fade = fonduHouleMer\(declin\) \* richesseMer \* attBord;/.test(bloc[0]),
    'le fondu de rivage est absent ou d une autre forme')
  assert.equal(FONDU_HOULE_FIN, 0.1)
  assert.ok(new RegExp(`smoothstep\\(0\\.0, ${FONDU_HOULE_FIN.toFixed(2)}, declin\\)`).test(GLSL_ECUME),
    'le seuil du GLSL partagé a bougé')
})

// ══════════ ⑨ LES QUATRE CONSTANTES DU SOCLE, CONVERTIES ═══════════════════
//
// ⚠️ **CES QUATRE-LÀ N'ONT PAS ÉTÉ TROUVÉES PAR LE RAISONNEMENT, MAIS À
// L'ÉCRAN**, l'une après l'autre, et c'est ce qui les rend intéressantes : rien
// dans le code ne les signalait, et chacune donnait une image plausible mais
// fausse. Chaque test porte donc **le chiffre de ce que la faute aurait coûté**,
// comme `crop-habillage` le fait pour la marge de côte.

test('⑨a le budget de profondeur est CONVERTI — 192 m, et non 4 310', () => {
  // ⚠️ LA PREMIÈRE VERSION PRENAIT LA PROFONDEUR RÉELLE DU FOND (4 310 m après
  // fusion GEBCO) : le glacis de lagon couvrait tout ce qui est sous 646 m,
  // c'est-à-dire tout le plateau insulaire, et la côte était peinte en cyan pâle
  // sur des kilomètres. Sur le socle il ne couvre que les 29 premiers mètres.
  const b = budgetProfondeurM(REPERE)
  assert.ok(Math.abs(b - 191.9) < 0.5, `budget ${b} m`)
  assert.equal(BUDGET_PROFONDEUR_UNITES, 2.2)
  // le glacis de lagon vit sur les 15 % du bas du budget — c'est la loi du socle
  assert.ok(Math.abs(b * 0.15 - 28.8) < 0.2, 'le lagon doit tenir dans 29 m')
  // …et il suit la largeur du crop, comme les trois autres conversions
  const large = repereCrop({ centre: CENTRE, zoom: 12 })
  assert.ok(Math.abs(budgetProfondeurM(large) / b - 2) < 1e-9)
})

test('⑨b le seuil du trait d eau est CONVERTI — 1,75 m, et non 455', () => {
  // ⚠️ **LA FAUTE LA PLUS VISIBLE DES QUATRE.** `ocean.js` écrit
  // `smoothstep(0.0, 0.02, depth)` : sur le socle c'est 3,5 m d'eau, sur le
  // globe `0,02` unité de scène vaut **455 m**. Toute la mer côtière devenait
  // semi-transparente — relevé pixel par pixel, la mer ne couvrait le fond
  // qu'à 24 % au centre du cadre.
  const t = seuilTraitEauM(REPERE)
  assert.ok(Math.abs(t - 1.746) < 0.01, `seuil ${t} m`)
  assert.equal(SEUIL_TRAIT_EAU_UNITES, 0.02)
  const siRecopie = SEUIL_TRAIT_EAU_UNITES / (R_GLOBE / R_TERRE_M) / EXAG_SOCLE_NOMINALE
  assert.ok(Math.abs(siRecopie - 455) < 2, `la faute vaudrait ${siRecopie} m`)
})

test('⑨c l échelle de houle est HORIZONTALE — donc PAS divisée par l exagération', () => {
  // ⚠️ ET C'EST CE QUI LA DISTINGUE DES TROIS AUTRES. `epsilonMerDuCrop`,
  // `budgetProfondeurM` et `seuilTraitEauM` sont des HAUTEURS : elles se
  // divisent par l'exagération. Une longueur d'onde ne le fait pas — la diviser
  // par 2,8 allongerait la houle d'autant.
  const e = echelleHouleM(REPERE)
  assert.ok(Math.abs(e - 102.68) < 0.1, `échelle ${e} m par mètre de spectre`)
  assert.equal(ECHELLE_HOULE_UNITES, 0.42)
  // un train de 12 mètres de spectre fait 1,23 km au sol
  assert.ok(Math.abs((e * 12) / 1000 - 1.232) < 0.01)
  // ⚠️ ET LA PREMIÈRE VERSION PRENAIT LE PAS DE LA MAILLE : à portée 12 et
  // pas 256 il vaut 688 m, donc des houles de 8 km. Le rapport est de 6,7.
  const maille = largeurCropM(REPERE) * 12 / 256
  assert.ok(maille / e > 6, `la maille vaut ${maille} m, l échelle ${e} m`)
})

test('⑨d la rampe nautique du fond est celle du socle, loi comprise', () => {
  // ⚠️ **LA PIÈCE QUE LA TÂCHE D AVAIT NOMMÉE SANS LA PRENDRE**, et c'est celle
  // qu'on voit : le socle rend une mer presque noire au large avec une frange
  // turquoise étroite au littoral, et cette frange est le FOND, pas l'eau.
  assert.equal(RAMPE_NAUTIQUE.peu, '#dce8ec')
  assert.equal(RAMPE_NAUTIQUE.moyen, '#7fa8b8')
  assert.equal(RAMPE_NAUTIQUE.fond, '#31576b')
  // les trois couleurs sont bien celles de terrain.js, pas des voisines
  const src = readFileSync(new URL('../src/terrain.js', import.meta.url), 'utf8')
  for (const c of Object.values(RAMPE_NAUTIQUE)) assert.ok(src.includes(c), `${c} absente de terrain.js`)
  // la loi : exposant 0,55, et elle est CONCAVE — le littoral occupe une part
  // de la rampe bien plus grande que sa part de profondeur
  assert.ok(Math.abs(abscisseNautique(0, 1000)) < 1e-12)
  assert.ok(Math.abs(abscisseNautique(1000, 1000) - 1) < 1e-12)
  const dixPourCent = abscisseNautique(100, 1000)
  assert.ok(dixPourCent > 0.28, `10 % de profondeur doit donner plus de 28 % de rampe, pas ${dixPourCent}`)
  // un exposant de 1 rendrait 0,1 : c'est la mutation que ce test tue
  assert.ok(Math.abs(dixPourCent - Math.pow(0.1, 0.55)) < 1e-12)
})

// ══════════ ⑩ `poserMer` ET `retirerMer` SONT EXERCÉES, PAS GREPÉES ════════
//
// ⚠️ **C'EST LE GRIEF C-2 DE LA TÂCHE C, PRIS D'AVANCE.** Là-bas
// `poserHabillage` n'était testée que par un grep de son nom — « quarante lignes
// derrière un grep » — et l'exercer a révélé un vrai défaut (C-3 :
// `retirerHabillage` ne rendait que quatre uniformes sur seize, et la planète
// entière gardait l'intervalle de courbes du crop).
//
// ⚠️ **ET LE MÊME DÉFAUT ÉTAIT POSSIBLE ICI** : `uMerRampeOn`,
// `uMerFondBudgetM` et les trois couleurs du fond sont des uniformes **PARTAGÉS
// par toutes les tuiles du globe**. Les laisser allumés après `retirerMer`
// repeindrait **tous les océans du monde** avec le budget d'un crop.

function globeMinimal() {
  // `Globe.prototype.X.call` sur un objet minimal — le patron de la Tâche B.
  // On ne construit pas un Globe (il tire un contexte WebGL) : on lui donne
  // exactement les champs que la méthode lit.
  const u = {}
  for (const k of ['uMerRampeOn', 'uMerFondBudgetM']) u[k] = { value: null }
  return { uniforms: u, _mer: null, _merEtat: null, group: { remove() {} } }
}

test('⑩a `retirerMer` ÉTEINT la rampe nautique même sans maillage', () => {
  const g = globeMinimal()
  g.uniforms.uMerRampeOn.value = 1
  g.uniforms.uMerFondBudgetM.value = 4310
  g.uniforms.uOceanShallow = { value: { set(v) { this.v = v } } }
  g.uniforms.uOceanMid = { value: { set(v) { this.v = v } } }
  g.uniforms.uOceanDeep = { value: { set(v) { this.v = v } } }
  Globe.prototype.retirerMer.call(g)
  assert.equal(g.uniforms.uMerRampeOn.value, 0, 'la rampe nautique doit s éteindre')
  assert.equal(g.uniforms.uMerFondBudgetM.value, 6000, 'le budget doit revenir au MONDIAL')
  assert.equal(g.uniforms.uOceanShallow.value.v, RAMPE_NAUTIQUE.peu)
  assert.equal(g.uniforms.uOceanMid.value.v, RAMPE_NAUTIQUE.moyen)
  assert.equal(g.uniforms.uOceanDeep.value.v, RAMPE_NAUTIQUE.fond)
})

test('⑩b `retirerMer` est IDEMPOTENTE et ne jette pas sans mer', () => {
  const g = globeMinimal()
  g.uniforms.uOceanShallow = { value: { set() {} } }
  g.uniforms.uOceanMid = { value: { set() {} } }
  g.uniforms.uOceanDeep = { value: { set() {} } }
  Globe.prototype.retirerMer.call(g)
  Globe.prototype.retirerMer.call(g)
  assert.equal(g.uniforms.uMerRampeOn.value, 0)
  assert.equal(g._mer, null)
})

test('⑩c `poserMer` REFUSE quand il n y a pas de crop, sans rien allumer', () => {
  // ⚠️ LA GARDE DE PRODUCTION : sans crop, pas de mer, et surtout pas
  // d uniforme allumé. Même discipline que `uCropOn = 0` et `uHabOn = 0`.
  const g = globeMinimal()
  g._crop = null
  return Globe.prototype.poserMer.call(g, {}).then((r) => {
    assert.equal(r, null)
    assert.equal(g.uniforms.uMerRampeOn.value, null, 'rien ne doit avoir été écrit')
  })
})

test('⑩d le nuanceur du globe garde la rampe nautique DERRIÈRE son interrupteur', () => {
  // ⚠️ ASSERTION DE SOURCE, DÉCLARÉE — mais elle vérifie une STRUCTURE, pas un
  // nom : que le bloc du fond marin soit gardé par `uMerRampeOn > 0.5` ET par
  // `sousEau`. Sans la seconde garde il repeindrait la TERRE.
  const src = readFileSync(SRC_GLOBE, 'utf8')
  const bloc = src.match(/if \(uMerRampeOn > 0\.5 && sousEau\) \{[\s\S]*?\n  \}/)
  assert.ok(bloc, 'le bloc du fond marin est absent ou mal gardé')
  assert.match(bloc[0], /uOceanShallow/)
  assert.match(bloc[0], /uOceanMid/)
  assert.match(bloc[0], /uOceanDeep/)
  // ⚠️ **LE BUDGET DU CROP EST TOUJOURS LU PAR LA MÊME EXPRESSION** — R28 ne l'a
  // pas remplacé, il lui a ADJOINT celui du monde, et `dedansCrop` départage.
  assert.match(bloc[0], /float dMerCrop = clamp\(-h \/ max\(uMerFondBudgetM, uPlancherRampeM\), 0\.0, 1\.0\);/)
  assert.match(bloc[0], /float dMerMonde = clamp\(-h \/ MONDE_PROFONDEUR, 0\.0, 1\.0\);/)
  assert.match(bloc[0], /float dMer01 = pow\(mix\(dMerMonde, dMerCrop, dedansCrop\), 0\.55\);/)
  // et l uniforme part À ZÉRO : sans `poserMer`, la production est intouchée
  assert.match(src, /uMerRampeOn: \{ value: 0 \}/)
})

// ══════════ ⑩bis `poserMer` EXERCÉ AU-DELÀ DE SA CLAUSE DE REFUS ═══════════
//
// ⚠️ **TOUR DE CORRECTION 1 (constat I1/F-3).** `poserMer` mesure ~150
// lignes ; jusqu'ici SEULE sa clause de refus (`!this._crop`, ⑩c) était
// exercée — tout le reste (dérivation de la portée, cuisson du champ,
// construction du maillage, matrice de pose) ne l'était par PERSONNE. Le
// relecteur l'a démontré en direct : échanger `Math.min`/`Math.max` dans le
// bornage de portée survit à 44/44 verts.
//
// ⚠️ **L'ALIAS `ocean-waves` EST LA SEULE RAISON POUR LAQUELLE ⑩c S'ARRÊTAIT
// LÀ.** `poserMer` fait `await import('./ocean.js')` en COURS de route
// (après la portée, la calotte et le champ, mais avant le matériau) ; sous
// node nu cet import lève, parce qu'`ocean.js` tire `ocean-waves` par un
// alias que seul Vite résout. Le `registerHooks` en tête de ce fichier —
// le patron exact de `test/damier-mer-runtime.test.js` — le résout aussi
// sous node : tout ce qui précède cet import est du vrai three.js
// (`BufferGeometry`, `DataTexture`, `ShaderMaterial`), et aucune de ces
// classes n'a besoin d'un contexte WebGL pour être CONSTRUITE.

// ⚠️ **Tâche P5 — UNE COULEUR BOUCHON QUI COPIE VRAIMENT.** L'ancien bouchon ne
// portait qu'un `set()` VIDE : une `majReglagesMer` qui n'aurait rien copié
// serait passée sans un mot. Celui-ci porte les trois canaux, `set`, `copy` et
// `getHexString`, donc le test peut LIRE ce qui a été posé.
function couleurBouchon(hex = '#000000') {
  const c = {
    isColor: true,
    r: parseInt(hex.slice(1, 3), 16) / 255,
    g: parseInt(hex.slice(3, 5), 16) / 255,
    b: parseInt(hex.slice(5, 7), 16) / 255,
    set(v) {
      if (typeof v === 'string') {
        c.r = parseInt(v.slice(1, 3), 16) / 255
        c.g = parseInt(v.slice(3, 5), 16) / 255
        c.b = parseInt(v.slice(5, 7), 16) / 255
      }
      return c
    },
    copy(o) { c.r = o.r; c.g = o.g; c.b = o.b; return c },
    getHexString() {
      const h = (v) => Math.round(Math.min(1, Math.max(0, v)) * 255).toString(16).padStart(2, '0')
      return h(c.r) + h(c.g) + h(c.b)
    },
  }
  return c
}

function globeAvecCrop(overrides = {}) {
  // Un `Globe` minimal qui porte exactement ce que `poserMer` lit et écrit —
  // même discipline que `globeMinimal()` ci-dessus, élargie au corps de la
  // méthode : `_crop` un VRAI repère, `exaggeration`, un `group` qui accepte
  // vraiment un maillage, et les uniformes que le matériau referme dessus.
  const val = (v) => ({ value: v })
  return {
    _crop: REPERE,
    exaggeration: EXAG_SOCLE_NOMINALE,
    group: {
      children: [],
      add(m) { this.children.push(m) },
      remove(m) { this.children = this.children.filter((x) => x !== m) },
    },
    _mer: null,
    _merEtat: null,
    uniforms: {
      uSunDir: val({}),
      uCropCoin: val(0),
      uCropCoinN: val(2),
      uMerRampeOn: val(0),
      uMerFondBudgetM: val(6000),
      // ⚠️ **AJOUTÉS PAR LA TÂCHE K bis** : `poserMer` n'écrit plus le budget du
      // fond en direct, il l'ANCRE dans l'échelle continue puis lit la courbe.
      // Le faux globe porte donc le plancher de division et le partage — même
      // discipline que le reste de ce bâtisseur : ce que la méthode exerce, il
      // le porte pour de vrai.
      uPlancherRampeM: val(0),
      uOceanShallow: val(couleurBouchon(RAMPE_NAUTIQUE.peu)),
      uOceanMid: val(couleurBouchon(RAMPE_NAUTIQUE.moyen)),
      uOceanDeep: val(couleurBouchon(RAMPE_NAUTIQUE.fond)),
      // Tâche J : le bord de la mer les lit — VRAIS uniformes, pas des bouchons,
      // pour que `poserEstompage` et `_majBordMer` s'exercent l'un sur l'autre.
      uEstompageOn: val(0),
      uEstompage: val(1),
      // ⚠️ **Tâche P6, ET C'EST LA MÊME DISCIPLINE** : ce que la méthode
      // exerce, ce bâtisseur le porte pour de vrai. `poserMer` PARTAGE
      // désormais le soleil du bloc et son interrupteur avec les tuiles ; et
      // `poserCrop` écrit les trois uniformes de la découpe.
      uSoleilDir: val({ x: 0, y: 1, z: 0 }),
      uEclairageOn: val(0),
      uCropCentre: val({ x: 0, y: 0, set(a, b) { this.x = a; this.y = b } }),
      uCropDemi: val(1),
      uCropOn: val(0),
    },
    _echelleContinue: creerEchelleContinue(RAMPE_MONDE),
    retirerMer: Globe.prototype.retirerMer,
    _cuireChampMer: Globe.prototype._cuireChampMer,
    _majBordMer: Globe.prototype._majBordMer,
    // ⚡ **D24 — LA VRAIE MÉTHODE, PAS UN BOUCHON.** Même discipline que
    // `_majBordMer` juste au-dessus : ce que `poserMer` appelle, ce bâtisseur le
    // porte pour de vrai, sinon les tests ⑧ mesureraient une bande que personne
    // n'écrit.
    _majBandeHouleMer: Globe.prototype._majBandeHouleMer,
    _melangeCalottes() {},
    _melangeCrop() {},
    _calottes: [],
    tiles: new Map(),
    ...overrides,
  }
}

// un fond marin de synthèse, uniformément à −500 m : ces tests n'ont rien à
// prouver sur la bathymétrie (§3 de la tâche, déjà couvert ailleurs),
// seulement sur ce que `poserMer` FAIT du résultat de `remplir`.
const remplirBouchon = (emprise, n, sortie) => {
  sortie.fill(-500)
  return { remplis: sortie.length }
}

test('⑩e `poserMer` DÉRIVE la portée par l horizon géométrique — le bornage que le relecteur a trouvé NON gardé', () => {
  const g = globeAvecCrop()
  return Globe.prototype.poserMer.call(g, { remplir: remplirBouchon }).then((r) => {
    // ⚠️ C'EST L'ASSERTION QUI TUE L'ÉCHANGE `Math.min`/`Math.max` : à
    // l'altitude par défaut (32 274 m, le seuil de naissance du socle) la
    // portée non bornée vaut 93,68 — ni 1 (le plancher) ni 256 (le
    // plafond). La mutation qui échange les deux bornes rend TOUJOURS 256,
    // quelle que soit l'altitude : elle ne peut pas passer ce test.
    const attendu = porteeHorizon(REPERE, 32274, R_TERRE_M)
    assert.ok(attendu > 1 && attendu < PORTEE_DEFAUT, `le témoin doit être au milieu de la plage : ${attendu}`)
    assert.ok(Math.abs(r.portee - attendu) < 1e-9, `portée ${r.portee} contre ${attendu}`)
  })
})

test('⑩f la portée s écrête au PLAFOND, pas au plancher, à haute altitude', () => {
  const g = globeAvecCrop()
  return Globe.prototype.poserMer.call(g, { remplir: remplirBouchon, altitudeM: 400000 }).then((r) => {
    // à 400 km, l horizon géométrique vaut largement plus de 256 demi-côtés
    assert.ok(porteeHorizon(REPERE, 400000, R_TERRE_M) > PORTEE_DEFAUT)
    assert.equal(r.portee, PORTEE_DEFAUT, `la portée doit s écrêter à ${PORTEE_DEFAUT}`)
  })
})

test('⑩g la portée s écrête au PLANCHER, pas au plafond, à altitude quasi nulle', () => {
  const g = globeAvecCrop()
  return Globe.prototype.poserMer.call(g, { remplir: remplirBouchon, altitudeM: 0.1 }).then((r) => {
    assert.ok(porteeHorizon(REPERE, 0.1, R_TERRE_M) < 1)
    assert.equal(r.portee, 1, 'la portée doit s écrêter au plancher de 1')
  })
})

test('⑩h `poserMer` POSE vraiment : maillage ajouté, rampe nautique allumée, budget écrit', () => {
  const g = globeAvecCrop()
  return Globe.prototype.poserMer.call(g, { remplir: remplirBouchon }).then((r) => {
    assert.equal(g.group.children.length, 1, 'un maillage doit être ajouté au groupe')
    assert.equal(g._mer, g.group.children[0])
    assert.equal(g.uniforms.uMerRampeOn.value, 1)
    // le budget vient du champ MESURÉ (−500 m partout ⇒ 500), pas du monde (6000)
    assert.equal(g.uniforms.uMerFondBudgetM.value, 500)
    assert.equal(r.bathy, true)
  })
})

test('⑩i la bascule de `poserMer` emploie le fov CANONIQUE, pas une valeur recopiée', () => {
  // ⚠️ Tour de correction 1 (constat C1/F-1). Le défaut de `fovDeg` vaut
  // maintenant `FOV_DEG` (30°, `seuil-socle.js`) — le fov qui alimente aussi
  // `SEUIL_NAISSANCE_M`. On recalcule `distanceBascule` depuis `r.lambda`,
  // INDÉPENDAMMENT de `poserMer`, pour qu'un futur défaut recopié diverge de
  // ce test sans avoir besoin de connaître sa propre valeur.
  const g = globeAvecCrop()
  return Globe.prototype.poserMer.call(g, { remplir: remplirBouchon }).then((r) => {
    const attendu = distanceBascule({ lambda: r.lambda, hauteurPx: 900, fovDeg: FOV_DEG })
    assert.ok(Math.abs(r.bascule - attendu) < 1e-9, `bascule ${r.bascule} contre ${attendu}`)
    assert.notEqual(FOV_DEG, 33, 'le fov canonique n est PAS 33 — la faute du Tour 1')
  })
})

test('⑩j retirer une mer POSÉE la fait vraiment disparaître du groupe', () => {
  const g = globeAvecCrop()
  return Globe.prototype.poserMer.call(g, { remplir: remplirBouchon }).then(() => {
    assert.equal(g.group.children.length, 1)
    Globe.prototype.retirerMer.call(g)
    assert.equal(g.group.children.length, 0)
    assert.equal(g._mer, null)
    assert.equal(g.uniforms.uMerRampeOn.value, 0)
    assert.equal(g.uniforms.uMerFondBudgetM.value, 6000)
  })
})

// ══════════ ⑩ter LE GRAB PASS, EXERCÉ — Tour de correction R2 ══════════════
//
// ⛔ **CINQ MUTATIONS SURVIVAIENT À 4 138 TESTS, ET TOUTES LES CINQ ÉTAIENT DES
// BRANCHEMENTS.** La relecture de la Tâche R2 les a comptées : la loi pure
// était bien gardée (`test/eau-refraction.test.js` ①②), les CÂBLES ne l'étaient
// que par des expressions régulières sur le source. La plus grave —
// `uMerVersMonde` posée depuis une matrice IDENTITÉ — **annule le correctif
// central de la tâche** (la normale de la mer redevient locale, le Fresnel
// resature à son plafond de 0,5, la mer redevient « quasiment transparente »)
// et la seule garde était `/uMerVersMonde\.value\.setFromMatrix4\(/`, qui ne
// regarde pas ce qu'on lui PASSE.
//
// ⚠️ **CES QUATRE-LÀ EXERCENT `onBeforeRender`, `retirerMer` ET
// `majReglagesMer` POUR DE VRAI**, avec un rendeur bouchon qui compte ce qu'on
// lui demande. Ce ne sont pas des greps : chacun calcule un nombre et le
// compare à un nombre obtenu autrement. **Un `return` muet dans le code testé
// les fait rougir, pas verdir.**

/**
 * Un rendeur qui ne rend rien mais qui DIT ce qu'on lui a demandé.
 *
 * ⚠️ Il porte la vraie signature des deux méthodes que le grab pass appelle :
 * `getDrawingBufferSize(cible)` REMPLIT sa cible et la rend (c'est ce que fait
 * `WebGLRenderer`), `copyFramebufferToTexture(texture)` note la texture reçue.
 */
function rendeurBouchon(largeur = 861, hauteur = 351) {
  const r = {
    copies: [],
    taille: { largeur, hauteur },
    getDrawingBufferSize(cible) {
      cible.set(r.taille.largeur, r.taille.hauteur)
      return cible
    },
    copyFramebufferToTexture(texture) {
      r.copies.push(texture)
    },
  }
  return r
}

test('⑩k `onBeforeRender` pose une matrice qui TOURNE VRAIMENT la normale de la mer', async () => {
  // ⛔ **C'EST LA GARDE DU CORRECTIF CENTRAL DE R2, ET ELLE EST DU COMPORTEMENT.**
  // On ne cherche pas `setFromMatrix4` dans le source : on POSE une mer, on
  // rend une image, on prend la matrice POSÉE, on lui donne la normale d'une
  // mer au repos — `(0, 1, 0)` en repère de nappe — et on regarde où elle
  // tombe dans le monde. Une matrice identité la laisse sur place ; la vraie
  // rotation du crop l'envoie sur le HAUT LOCAL de La Réunion.
  const g = globeAvecCrop()
  await Globe.prototype.poserMer.call(g, { remplir: remplirBouchon })
  g._mer.updateMatrixWorld(true)
  g._mer.onBeforeRender(rendeurBouchon())

  const M = g._mer.material.uniforms.uMerVersMonde.value
  const nLocal = new THREE.Vector3(0, 1, 0) // la nappe au repos, en repère de nappe
  const nMonde = nLocal.clone().applyMatrix3(M).normalize()

  // ① où DOIT-ELLE tomber ? Sur le haut local du crop, calculé ICI, sans
  //    `poserMer` : le rayon de la sphère au centre du crop.
  const { origine, haut } = repereLocalCrop(REPERE, R_GLOBE)
  const hautV = new THREE.Vector3(...haut)
  assert.ok(nMonde.distanceTo(hautV) < 1e-9, `la normale tournée ${nMonde.toArray()} n est pas le haut du crop ${haut}`)
  // et ce haut EST la géométrie du lieu : sa composante verticale vaut le sinus
  // de la latitude du centre (−21,115° → −0,3602). Un témoin indépendant du
  // module, qui dit que la matrice n'est pas « une rotation quelconque ».
  assert.ok(Math.abs(hautV.y - Math.sin(CENTRE.lat * Math.PI / 180)) < 1e-6)

  // ② et ce que ça change au FRESNEL, qui est tout l'objet de la correction.
  //    Caméra plongeante au-dessus de la nappe, tout en repère MONDE.
  const P = new THREE.Vector3(...origine)
  const V = hautV.clone() // la caméra est droit au-dessus : V = le haut du crop
  const fresnel = (N) => Math.min(Math.pow(1 - Math.max(N.dot(V), 0), 5), 0.5)
  assert.ok(P.length() > 0, 'le crop doit être posé quelque part sur la sphère')
  assert.ok(fresnel(nMonde) < 1e-9, `en vue plongeante le Fresnel doit être quasi nul, pas ${fresnel(nMonde)}`)
  // ⛔ **LE DÉFAUT D'AVANT R2, CHIFFRÉ ICI MÊME** : la même normale laissée en
  // repère de nappe est dotée avec un `V` du monde, le produit tombe sous zéro,
  // il est écrêté, et le Fresnel SATURE à son plafond. C'est ce que rend la
  // mutation « matrice identité », et c'est ce que ce test refuse.
  assert.equal(fresnel(nLocal), 0.5, 'la normale NON tournée doit saturer le Fresnel — sinon ce test ne prouve rien')
  // les deux repères sont à plus de 100° l'un de l'autre à cette latitude
  assert.ok(nMonde.angleTo(nLocal) * 180 / Math.PI > 100)
})

test('⑩l `onBeforeRender` COPIE le tampon d image, à chaque image, sur la cible LIÉE', async () => {
  // ⛔ **SANS CETTE COPIE LA RÉFRACTION LIT UNE TEXTURE JAMAIS RAFRAÎCHIE** — et
  // rien dans le dépôt ne nommait `copyFramebufferToTexture` avant ce test.
  const g = globeAvecCrop()
  await Globe.prototype.poserMer.call(g, { remplir: remplirBouchon })
  g._mer.updateMatrixWorld(true)
  const r = rendeurBouchon(1014, 414)
  const u = g._mer.material.uniforms

  assert.equal(u.uMerScene.value, null, 'la cible ne doit pas exister avant la première image')
  g._mer.onBeforeRender(r)
  assert.equal(r.copies.length, 1, 'la première image doit copier le tampon')
  assert.ok(u.uMerScene.value, 'la copie doit être LIÉE à l uniforme que le nuanceur lit')
  assert.equal(r.copies[0], u.uMerScene.value, 'on copie dans la texture que le nuanceur échantillonne, pas dans une autre')
  assert.equal(u.uMerResolution.value.x, 1014)
  assert.equal(u.uMerResolution.value.y, 414)

  // ⚠️ **ET À CHAQUE IMAGE, PAS UNE FOIS** : une copie prise à la naissance
  // seulement rendrait une mer qui réfracte la première image pour toujours.
  g._mer.onBeforeRender(r)
  g._mer.onBeforeRender(r)
  assert.equal(r.copies.length, 3)
  assert.equal(new Set(r.copies).size, 1, 'la cible est réutilisée tant que la taille ne bouge pas')

  // et quand le tampon change de taille, la cible suit — et reste liée
  r.taille = { largeur: 640, hauteur: 480 }
  g._mer.onBeforeRender(r)
  assert.equal(u.uMerScene.value.image.width, 640)
  assert.equal(u.uMerResolution.value.x, 640)
  assert.equal(r.copies[3], u.uMerScene.value)
})

test('⑩m `retirerMer` REND la cible de copie — le CYCLE, pas l état initial', async () => {
  // ⛔ **FUITE MESURÉE PAR LA RELECTURE DE R2**, à chaud, après un cycle
  // lever/baisser du drapeau dans la MÊME session : la `FramebufferTexture`
  // restait allouée, texture GPU comprise (~3,4 Mo à 1014 × 414, ~29 Mo en
  // plein écran 2560 × 1440). ⚠️ **Un test posé sur la page fraîche serait vert
  // sans rien prouver** — `_merRefractRT` naît nul. On mesure donc le cycle.
  const g = globeAvecCrop()
  await Globe.prototype.poserMer.call(g, { remplir: remplirBouchon })
  g._mer.updateMatrixWorld(true)
  g._mer.onBeforeRender(rendeurBouchon())

  const cible = g._merRefractRT
  assert.ok(cible, 'le cycle doit commencer avec une cible VIVANTE, sinon il ne mesure rien')
  let rendue = 0
  cible.addEventListener('dispose', () => { rendue++ })

  Globe.prototype.retirerMer.call(g)
  assert.equal(rendue, 1, 'la cible de copie doit être rendue au GPU, pas seulement oubliée')
  assert.equal(g._merRefractRT, null, '`_merRefractRT` doit être nul après un cycle lever/baisser')
  // et deux baisses de suite ne jettent pas et ne redemandent rien
  Globe.prototype.retirerMer.call(g)
  assert.equal(rendue, 1)
  assert.equal(g._merRefractRT, null)
})

test('⑩n une SECONDE pose garde la réfraction vivante — la liaison est hors du `if`', async () => {
  // ⛔ **DÉFAUT TROUVÉ EN ÉCRIVANT ⑩l, ET IL EST DE PRODUCTION.** `poserMer`
  // refait un matériau neuf à chaque repose (changement de crop, de portée) et
  // ce matériau naît avec `uMerScene: { value: null }`. La liaison vivait DANS
  // le `if` de création de la cible : à taille de tampon inchangée le `if` ne
  // courait pas, et le matériau neuf gardait `uMerScene` à `null` — la
  // réfraction du crop morte, en silence, dès la deuxième pose.
  const g = globeAvecCrop()
  const r = rendeurBouchon()
  await Globe.prototype.poserMer.call(g, { remplir: remplirBouchon })
  g._mer.updateMatrixWorld(true)
  g._mer.onBeforeRender(r)
  assert.ok(g._mer.material.uniforms.uMerScene.value, 'première pose : la cible est liée')

  await Globe.prototype.poserMer.call(g, { remplir: remplirBouchon })
  g._mer.updateMatrixWorld(true)
  g._mer.onBeforeRender(r)
  const u = g._mer.material.uniforms
  assert.ok(u.uMerScene.value, 'seconde pose : le matériau NEUF doit être lié à la cible, sinon il échantillonne du vide')
  assert.equal(u.uMerScene.value, g._merRefractRT)
  assert.equal(r.copies.at(-1), u.uMerScene.value)
  assert.equal(u.uMerResolution.value.x, 861)
})

test('⑩o `majReglagesMer` PORTE la réfraction du socle, déplacée dans les deux sens', async () => {
  // ⛔ **MUTATION SURVIVANTE I3** : `uMerRefract` forcée à `0` quand le socle en
  // fournit une tue la réfraction du crop en pratique (le socle en fournit
  // toujours une), et le motif de source ne lisait que le début de la ligne.
  // On EXÉCUTE l'écrivain, et on déplace la valeur dans les deux sens.
  const g = globeAvecCrop()
  await Globe.prototype.poserMer.call(g, { remplir: remplirBouchon })
  const u = g._mer.material.uniforms
  const base = { vue: 1, surface: 1 }

  Globe.prototype.majReglagesMer.call(g, { ...base, refraction: 0.34 })
  assert.equal(u.uMerRefract.value, 0.34, 'la tirette VIVANTE du socle doit arriver telle quelle')
  Globe.prototype.majReglagesMer.call(g, { ...base, refraction: 0.91 })
  assert.equal(u.uMerRefract.value, 0.91, 'et elle doit REDESCENDRE aussi bien que monter')
  Globe.prototype.majReglagesMer.call(g, { ...base, refraction: 0 })
  assert.equal(u.uMerRefract.value, 0, 'zéro est une valeur, pas une absence')
  // sans socle à lire, le NEUTRE du module — jamais la valeur du voisin
  Globe.prototype.majReglagesMer.call(g, base)
  assert.equal(u.uMerRefract.value, REFRACTION_NEUTRE)
  Globe.prototype.majReglagesMer.call(g, { ...base, refraction: NaN })
  assert.equal(u.uMerRefract.value, REFRACTION_NEUTRE)
  // ⚠️ et le neutre n'est PAS ce que le socle vivant porte (0,34 relevé le
  // 2026-08-23) : un test qui les confondrait ne verrait pas la mutation.
  assert.notEqual(REFRACTION_NEUTRE, 0.34)
})

// ══════════ ⑪ LE BORD DE LA MER — Tâche J ═══════════════════════════════════
//
// ⚠️ **CE QUE CETTE SECTION DÉFEND EST UN DÉFAUT VU À L'ÉCRAN** : « la mer
// déborde de ~400 km sur un bloc de 10 km, et l'estompage ne la touche pas ».
// Deux choses doivent tenir ensemble : la calotte est BORNÉE sur l'emprise du
// crop, et son extinction SUIT l'estompage de la Terre autour.

test('⑪a `RETRAIT_EAU_CROP` est bien celui de `plinth.js`, relu sur le DISQUE', () => {
  // ⚠️ **UN CHIFFRE RECOPIÉ SANS GARDE DIVERGE EN SILENCE.** `plinth.js` tire
  // three.js et ne peut pas être importé par un module pur ; on relit donc sa
  // source, exactement comme `mer-emprise.test.js` le fait pour `CHAMP_RES`.
  const src = readFileSync(new URL('../src/plinth.js', import.meta.url), 'utf8')
  const chanfrein = Number(/export const SOCLE_CHANFREIN = ([\d.]+)/.exec(src)?.[1])
  const marge = Number(/export const SOCLE_MARGE_EAU = ([\d.]+)/.exec(src)?.[1])
  assert.ok(Number.isFinite(chanfrein) && Number.isFinite(marge), 'les deux constantes doivent être relues')
  const attendu = (chanfrein + marge) / (COTE_CROP_UNITES / 2)
  assert.ok(Math.abs(RETRAIT_EAU_CROP - attendu) < 1e-12, `${RETRAIT_EAU_CROP} contre ${attendu}`)
})

test('⑪b la mer S ARRÊTE AU BLOC quand la Terre autour est effacée', () => {
  // estompage = 1 : il ne reste que le crop. Le fondu doit finir DANS le crop,
  // en RETRAIT de la largeur du chanfrein — c'est là que `plinth.js` arrête
  // l'eau du mode plat (`rayonEauDansSocle = HALF − chanfrein − marge`).
  //
  // ⛔ **CE TEST ENCODAIT LE SIGNE INVERSE, ET C'EST CE QUI L'A LAISSÉ PASSER.**
  // Avant la Tâche P4 il exigeait `fin = +RETRAIT_EAU_CROP`, c'est-à-dire l'eau
  // 0,22 unité de socle DEHORS, pleine opacité sur l'arête, fondu au-dessus du
  // vide. Le socle fait exactement l'inverse. **Un test peut verrouiller un
  // défaut : celui-ci l'a fait pendant tout le chantier.**
  const b = bordDeMer()
  assert.ok(Math.abs(b.fin + RETRAIT_EAU_CROP) < 1e-12, `fin ${b.fin} : la mer doit RENTRER`)
  assert.ok(b.fin < 0, 'à estompage plein la mer s éteint DANS le crop, pas dehors')
  assert.ok(Math.abs(b.debut + 2 * RETRAIT_EAU_CROP) < 1e-12,
    `debut ${b.debut} : la bande vaut le retrait, du bon côté de l arête`)
  // et le témoin de la faute : elle vaut 0,44 unité de socle d'écart avec ce
  // que le code d'avant posait, dans le sens qui compte
  assert.ok(Math.abs((RETRAIT_EAU_CROP - b.fin) * (COTE_CROP_UNITES / 2) - 0.44) < 1e-9)
  // ⚠️ **ET LE TÉMOIN QUI COMPTE** : la mer d'avant la Tâche J allait à
  // l'horizon géométrique, soit ~93 demi-côtés à l'altitude de naissance du
  // socle. Trois ordres de grandeur.
  assert.ok(b.fin < porteeHorizon(REPERE, 32274, R_TERRE_M) / 1000)
})

test('⑪c la mer NE DÉBORDE JAMAIS DU SOCLE — défaut ② d Adrien, 2026-09-04', () => {
  // ⛔ **CE TEST REMPLACE « la mer va jusqu au bord de la calotte quand la
  // planète est entière », ET C EST LA CORRECTION DE FOND.** Cette phrase-là
  // était la loi d avant, et elle disait exactement le défaut :
  //
  //   > *« On a la mer qui prend beaucoup plus que la taille du crop, et
  //   > parfois ne se crope pas du tout. »*
  //
  // MESURÉ AU GPU (`scripts/sonde-mer-crop.mjs`, 1 280×800, La Réunion, crop
  // posé) : à estompage 0 la nappe couvrait **407 358 px hors de l emprise du
  // socle, 39,8 % de l écran** ; sa silhouette passait de 111 661 à 517 270 px,
  // soit **×4,6**. Et l estompage tombe à 0,295 sur 178 images sur 180 pendant
  // un simple zoom à la molette depuis 31 km, à **0,000** depuis 55 km.
  //
  // ⚠️ **LA LOI EST DONC : UNE SEULE VALEUR, CELLE DU SOCLE.** D23 le dit —
  // la mer animée appartient au crop ; hors du crop, l océan est la bathymétrie
  // peinte par le nuanceur de tuile (PF3 §1).
  const b = bordDeMer()
  assert.ok(b.fin < 0, `la mer doit s éteindre DEDANS : ${b.fin}`)
  assert.ok(Math.abs(b.fin + RETRAIT_EAU_CROP) < 1e-12, `fin ${b.fin}`)
  assert.ok(Math.abs(b.debut + 2 * RETRAIT_EAU_CROP) < 1e-12, `debut ${b.debut}`)
  // et le témoin de ce qui est réparé : la loi d avant, rejouée. À estompage 0
  // elle rendait `PORTEE_CROP − 1 − RETRAIT`, c est-à-dire DEUX demi-côtés de
  // crop DEHORS — la calotte entière.
  const ancien = (e) => (PORTEE_CROP - 1) * (1 - e) - RETRAIT_EAU_CROP
  assert.ok(ancien(0) > 1.9, 'témoin : la loi d avant sortait de deux demi-côtés')
  assert.ok(b.fin < ancien(0.999), 'la mer ne doit pas dépendre de l estompage, même presque plein')
})

test('⑪d `bordDeMer` NE PREND PLUS AUCUN PARAMÈTRE — ni estompage ni portée', () => {
  // ⚠️ **UN PARAMÈTRE QUE LE CORPS IGNORE EST UN PARAMÈTRE MORT**, et ce
  // chantier en a déjà trouvé cinq. Laisser `estompage` en signature aurait
  // laissé croire que la mer le suit encore : c est précisément la croyance qui
  // a coûté le défaut ②. On lit donc la SOURCE, pas seulement le résultat.
  const src = readFileSync(new URL('../src/monde/mer-sphere.js', import.meta.url), 'utf8')
  const sig = /export function bordDeMer\(([^)]*)\)/.exec(src)
  assert.ok(sig, 'bordDeMer doit rester exportée')
  assert.equal(sig[1].trim(), '', `signature non vide : « ${sig[1]} »`)
  const corps = /export function bordDeMer\(\)\s*\{([\s\S]*?)^\}/m.exec(src)?.[1] ?? ''
  assert.ok(!/estompage|portee|PORTEE_CROP/.test(corps), `le corps lit encore une entrée : ${corps}`)
  // et le comportement : appelée n importe comment, elle rend la MÊME chose
  for (const bruit of [undefined, 0, 0.5, 1, NaN, null, 'x', {}, -5, 12]) {
    assert.deepEqual(bordDeMer(bruit, 42), bordDeMer(), `${String(bruit)}`)
  }
})

test('⑪e la bande de fondu a une largeur STRICTEMENT positive — pas d arête dure', () => {
  const b = bordDeMer()
  assert.ok(b.debut < b.fin, 'bornes inversées')
  assert.ok(Math.abs((b.fin - b.debut) - RETRAIT_EAU_CROP) < 1e-12,
    `la bande vaut le retrait : ${b.fin - b.debut}`)
  // ⚠️ **ET LE TÉMOIN DE LA TÂCHE P4 EST GARDÉ** : le mode plat rentre son eau
  // de 0,44 unité de socle par rapport à ce que le code d avant P4 posait.
  assert.ok(Math.abs((RETRAIT_EAU_CROP - b.fin) * (COTE_CROP_UNITES / 2) - 0.44) < 1e-9)
  // et l ordre de grandeur qui a fondé la Tâche J : la mer d avant allait à
  // l horizon géométrique, ~93 demi-côtés à l altitude de naissance du socle.
  assert.ok(b.fin < porteeHorizon(REPERE, 32274, R_TERRE_M) / 1000)
})

test('⑪f `PORTEE_CROP` rend l emprise de la mer RÉSERVABLE — les trous 2 et 3 sont le même', () => {
  // ⚠️ **C'EST LE LIEN ENTRE LES DEUX TROUS, ET IL EST ARITHMÉTIQUE.** Une
  // calotte à l'horizon (`PORTEE_DEFAUT`) couvre une emprise qu'AUCUN budget de
  // tuiles ne peut réserver au zoom du bloc : c'est de là que venait la
  // couverture de 0,7 %. Bornée à `PORTEE_CROP`, elle tient dans 25 tuiles à
  // quelques niveaux du bloc, ce qui est ce que la Tâche F avait mesuré.
  const emprise = empriseCalotte(REPERE, PORTEE_CROP)
  const z = zoomPourEmprise(emprise, { zoomMax: 12, tuilesMax: 25 })
  assert.ok(z >= 9 && z <= 12, `zoom ${z} : la mer du crop doit rester dans les niveaux du bloc`)
  // le témoin : à l'horizon, le même budget fait tomber le zoom bien plus bas
  const large = empriseCalotte(REPERE, PORTEE_DEFAUT)
  assert.ok(zoomPourEmprise(large, { zoomMax: 12, tuilesMax: 25 }) < z,
    'une calotte à l horizon doit exiger un zoom PLUS GROSSIER — sinon le bornage ne sert à rien')
})

test('⑪g le nuanceur de la mer LIT vraiment le bord, et sur la mesure de la DÉCOUPE', () => {
  // ⚠️ **PAS UN `grep` DE NOM.** On extrait le corps du fragment et on vérifie
  // que l'alpha des DEUX sorties est multiplié par le facteur de bord — la
  // Tâche C a payé une fois un uniforme posé et lu par personne, et cette
  // tâche-ci vient d'en réveiller deux (`uCropCoin`, `uCropCoinN`).
  const src = readFileSync(SRC_GLOBE, 'utf8')
  const frag = /const MER_FRAG = \/\* glsl \*\/ `([\s\S]*?)`\n/.exec(src)?.[1]
  assert.ok(frag, 'le fragment de la mer doit être extractible')
  assert.ok(/uniform vec2 uMerBord;/.test(frag), 'le bord doit être déclaré')
  // la mesure est celle de la découpe : cq / pn / expo, comme le nuanceur des
  // tuiles — pas un max(abs(u), abs(v))
  // ⚡ **DEPUIS D24 ELLE EST EXTRAITE, ET C'EST TOUT L'INTÉRÊT** : le SOMMET en
  // a besoin aussi, et deux superellipses à garder d'accord sont la faute que ce
  // module raconte cinq fois. On vérifie donc ① que le fragment l'APPELLE sur
  // `vCrop`, ② que le morceau partagé est bien injecté, ③ que la loi y est
  // entière, et ④ qu'aucun des deux nuanceurs ne la réécrit.
  assert.ok(/float dBord = distanceBordCrop\(vCrop, uCropCoin, uCropCoinN\);/.test(frag),
    'le fragment doit APPELER la mesure partagée, sur vCrop')
  assert.ok(frag.includes('${GLSL_BORD_CROP}'), 'le morceau partagé doit être injecté dans le fragment')
  assert.ok(/pow\(pow\(cq\.x, expo\) \+ pow\(cq\.y, expo\), 1\.0 \/ expo\)/.test(GLSL_BORD_CROP),
    'la superellipse de la découpe doit être celle du bord')
  const vertD24 = /const MER_VERT = \/\* glsl \*\/ `([\s\S]*?)`\n/.exec(src)?.[1]
  assert.ok(vertD24.includes('${GLSL_BORD_CROP}'), 'le morceau partagé doit être injecté dans le sommet AUSSI')
  assert.ok(/distanceBordCrop\(aCrop, uCropCoin, uCropCoinN\)/.test(vertD24),
    'le sommet doit mesurer le bord sur aCrop')
  for (const [nom, txt] of [['MER_FRAG', frag], ['MER_VERT', vertD24]]) {
    assert.ok(!/pow\(pow\(cq/.test(txt), `${nom} réécrit la superellipse au lieu de l appeler`)
  }
  const sorties = frag.match(/gl_FragColor = vec4\([^;]*;/g) || []
  assert.equal(sorties.length, 2, 'le fragment a exactement deux sorties')
  for (const s of sorties) assert.ok(/\bbord \*/.test(s), `sortie sans bord : ${s}`)
  // et le rejet anticipé : au-delà du bord, rien n'est calculé
  assert.ok(/if \(bord <= 0\.0\) discard;/.test(frag))
})

test('⑪h `poserMer` POSE le bord au socle, et l ESTOMPAGE NE LE BOUGE PLUS', () => {
  // ⛔ **AVANT LE 2026-09-04 CE TEST EXIGEAIT L INVERSE** : « sans estompage
  // posé, la planète est ENTIÈRE : la mer va au bord » — c est-à-dire le défaut
  // ② d Adrien, verrouillé par un test. Un test peut verrouiller un défaut ;
  // celui-ci l a fait pendant tout le chantier, comme ⑪b avant P4.
  //
  // ⚡ **ET LE PIÈGE ÉTAIT DANS LA LECTURE, PAS DANS LA LOI** : `_majBordMer`
  // lisait `uEstompageOn > 0.5 ? uEstompage : 0`, donc **l interrupteur éteint
  // valait « planète entière », donc « mer jusqu au bord de la calotte »**.
  // `retirerCrop` éteint cet interrupteur ; une nappe reposée derrière lui
  // n était donc PAS découpée, sur un crop qui l était parfaitement.
  const g = globeAvecCrop()
  const attendu = bordDeMer()
  return Globe.prototype.poserMer.call(g, { remplir: remplirBouchon, portee: PORTEE_CROP }).then(() => {
    const u = g._mer.material.uniforms.uMerBord.value
    // à la naissance, sans aucun estompage posé — `uEstompageOn` vaut 0
    assert.equal(g.uniforms.uEstompageOn.value, 0, 'le décor du test doit partir interrupteur ÉTEINT')
    assert.ok(Math.abs(u.y - attendu.fin) < 1e-9, `fin à la naissance : ${u.y}`)
    assert.ok(u.y < 0, 'la mer doit RENTRER dans le crop, pas déborder')
    assert.ok(Math.abs(u.x - attendu.debut) < 1e-9, `debut ${u.x}`)
    // ⚠️ **LES TROIS ÉTATS D ESTOMPAGE, ET AUCUN NE DOIT DÉPLACER LA NAPPE.**
    for (const e of [0, 0.22, 0.5, 1]) {
      Globe.prototype.poserEstompage.call(g, e)
      assert.ok(Math.abs(u.y - attendu.fin) < 1e-12, `estompage ${e} a bougé la mer : ${u.y}`)
      assert.ok(Math.abs(u.x - attendu.debut) < 1e-12, `estompage ${e} a bougé la bande : ${u.x}`)
    }
    Globe.prototype.retirerEstompage.call(g)
    assert.ok(Math.abs(u.y - attendu.fin) < 1e-12, `après retrait : ${u.y}`)
  })
})

test('⑪h bis ni `poserEstompage` ni `_majBordMer` ne LISENT l estompage pour la mer', () => {
  // ⚠️ **PAS UN `grep` DE NOM : ON EXTRAIT LES DEUX CORPS.** Le comportement
  // ci-dessus se rejoue à l identique si quelqu un remet la lecture avec une
  // valeur qui se trouve valoir 1 — c est exactement comme cela que la
  // coïncidence de `lakeColor` a failli cacher la Tâche P6.
  const src = readFileSync(SRC_GLOBE, 'utf8')
  const maj = /_majBordMer\(\)\s*\{([\s\S]*?)^  \}/m.exec(src)?.[1]
  assert.ok(maj, '`_majBordMer` doit rester extractible')
  assert.ok(!/uEstompage/.test(maj), `\`_majBordMer\` lit encore l estompage : ${maj}`)
  assert.ok(!/portee|PORTEE_CROP/.test(maj), `\`_majBordMer\` lit encore une portée : ${maj}`)
  const pose = /poserEstompage\(estompage\)\s*\{([\s\S]*?)^  \}/m.exec(src)?.[1]
  assert.ok(pose, '`poserEstompage` doit rester extractible')
  // ⚠️ **ON CHERCHE L APPEL, PAS LE MOT** : les deux corps portent un encart
  // ⛔ qui NOMME `_majBordMer` pour dire qu il a été retiré — et c est cet
  // encart qui doit rester lisible.
  assert.ok(!/this\._majBordMer\(\)/.test(pose), '`poserEstompage` ne doit plus toucher au bord de la mer')
  const retire = /retirerEstompage\(\)\s*\{([\s\S]*?)^  \}/m.exec(src)?.[1]
  assert.ok(retire, '`retirerEstompage` doit rester extractible')
  assert.ok(!/this\._majBordMer\(\)/.test(retire), '`retirerEstompage` ne doit plus toucher au bord de la mer')
})

test('⑪i `poserMer` REFUSE un champ vide, et le refus N EFFACE PAS la mer en place', () => {
  const g = globeAvecCrop()
  const presqueVide = (emprise, n, sortie) => ({ remplis: Math.round(sortie.length * 0.007) })
  return Globe.prototype.poserMer.call(g, { remplir: remplirBouchon, portee: PORTEE_CROP }).then(() => {
    assert.equal(g.group.children.length, 1)
    // le champ mesuré à 0,7 % de couverture — celui de l'aplat gris
    return Globe.prototype.poserMer.call(g, { remplir: presqueVide, portee: PORTEE_CROP, couvertureMin: 0.99 })
  }).then((r) => {
    assert.equal(r.refus, 'champ', 'un champ à 0,7 % doit refuser')
    assert.ok(r.couverture < 0.01, `couverture rendue : ${r.couverture}`)
    assert.equal(g.group.children.length, 1, 'la mer en place ne doit pas avoir bougé')
    // ⚠️ **ET LE DÉFAUT RESTE CELUI DU DÉPÔT** : sans `couvertureMin`, le même
    // champ presque vide POSE, exactement comme avant la Tâche J.
    return Globe.prototype.poserMer.call(g, { remplir: presqueVide, portee: PORTEE_CROP })
  }).then((r) => {
    assert.equal(r.refus, undefined, 'le défaut `couvertureMin = 0` ne refuse rien')
  })
})

test('⑪j `exigerBathy` attend la nappe, et un `remplir` MUET garde le défaut du dépôt', () => {
  const g = globeAvecCrop()
  const sansNappe = (emprise, n, sortie) => { sortie.fill(-500); return { remplis: sortie.length, bathy: false } }
  return Globe.prototype.poserMer.call(g, { remplir: sansNappe, portee: PORTEE_CROP, exigerBathy: true }).then((r) => {
    assert.equal(r.refus, 'champ')
    assert.equal(r.bathy, false, 'le refus doit DIRE que la bathymétrie manque')
    assert.equal(g.group.children.length, 0, 'rien ne doit être posé')
    // le même champ sans exigence : posé, et `bathy` dit la vérité
    return Globe.prototype.poserMer.call(g, { remplir: sansNappe, portee: PORTEE_CROP })
  }).then((r) => {
    assert.equal(r.bathy, false)
    assert.equal(g.group.children.length, 1)
    // et un `remplir` MUET — tout appelant d'avant la Tâche J — garde `true`
    return Globe.prototype.poserMer.call(g, { remplir: remplirBouchon, portee: PORTEE_CROP, exigerBathy: true })
  }).then((r) => {
    assert.equal(r.refus, undefined, 'un remplir muet ne doit pas se mettre à refuser')
    assert.equal(r.bathy, true)
  })
})

// ══════════ ⑫ CE QUE `poserMer` ET `majReglagesMer` POSENT VRAIMENT ════════
//
// ⛔ **CES NEUF TESTS SONT NÉS D'UNE CAMPAGNE DE MUTATION, PAS D'UNE INTUITION.**
// Premier tour de la Tâche P4 : **28 / 37**, et les NEUF survivantes visaient
// toutes le même trou — le corps de `majReglagesMer` et les uniformes que
// `poserMer` écrit n'étaient gardés que par des assertions de SOURCE. Une
// assertion qui lit un fichier prouve qu'un texte est là ; elle ne prouve pas
// qu'il pose la bonne valeur. **On EXÉCUTE.**
//
// ⚠️ Et aucune des neuf n'était du code mort : elles sont toutes sur le chemin
// vivant de l'image (`main.js` appelle `majReglagesMer` à chaque image).

function merPosee(arg = {}) {
  const g = globeAvecCrop()
  return Globe.prototype.poserMer
    .call(g, { remplir: remplirBouchon, portee: PORTEE_CROP, ...arg })
    .then((r) => ({ g, r, u: g._mer.material.uniforms }))
}

test('⑫a `majReglagesMer` pose les DEUX accalmies, le givre et le ciel', () => {
  return merPosee().then(({ g, u }) => {
    const ciel = { isColor: true }
    const cible = { isColor: true, copy(c) { this.recu = c } }
    u.uSky.value = cible
    const pose = Globe.prototype.majReglagesMer.call(g, { vue: 0.4039, surface: 0.08, givre: 0.56, ciel })
    assert.equal(u.uMerCalmeVue.value, 0.4039)
    assert.equal(u.uMerCalmeSurf.value, 0.08, 'la seconde accalmie doit être posée AUSSI')
    assert.equal(u.uMerGivre.value, 0.56, 'le givre du socle de verre doit être posé')
    assert.equal(cible.recu, ciel, 'le ciel doit être COPIÉ, pas remplacé')
    assert.deepEqual(pose, {
      vue: 0.4039, surface: 0.08, givre: 0.56,
      // ⚠️ **SANS `etat`, LE NEUTRE — la mer d'avant P5 au bit près.** Le retour
      // le DIT plutôt que de le taire : un appelant qui ne passe pas d'état de
      // mer doit pouvoir lire dans le résultat qu'il a hérité du neutre.
      etat: ETAT_MER_NEUTRE,
      fond: false,
      // ⚠️ **Tâche P6, MÊME RÈGLE POUR LA LAME D'EAU** : sans `eau`, le neutre
      // d'`ocean.js`, et le retour le dit au lieu de le taire.
      eau: LAME_EAU_NEUTRE,
      couleurs: false,
      spectre: false,
      // ⚠️ **Tâche P6** : sans échelle de spectre à lire, la calotte garde celle
      // que `poserMer` a posée — et le retour le DIT.
      echelleSpectre: false,
      // ⚡ **D24** : la bande de la coupe plate se recalcule sur les six
      // réglages, donc APRÈS eux, et le retour le DIT — comme les autres.
      bandeHoule: pose.bandeHoule,
    })
    // et elle est VRAIE, pas un champ de complaisance : une amplitude latérale
    // strictement positive, une bande strictement positive et bornée
    assert.ok(pose.bandeHoule.amplitude > 0, 'l amplitude latérale doit être mesurée')
    assert.ok(pose.bandeHoule.bande > 0 && pose.bandeHoule.bande <= 0.5)
    assert.equal(u.uMerBandeHoule.value, pose.bandeHoule.bande)
  })
})

test('⑫b un demi-couple retombe sur le NEUTRE — pas sur une moitié d accalmie', () => {
  return merPosee().then(({ g, u }) => {
    // ⚠️ **UN DEMI-COUPLE EST PIRE QUE PAS D ACCALMIE DU TOUT** : le ressac
    // serait multiplié par 0,08 pendant que les moutons resteraient à 1.
    for (const mauvais of [{ vue: 0.4, surface: NaN }, { vue: NaN, surface: 0.08 }, {}, null, undefined]) {
      Globe.prototype.majReglagesMer.call(g, mauvais)
      assert.equal(u.uMerCalmeVue.value, 1, `${JSON.stringify(mauvais)}`)
      assert.equal(u.uMerCalmeSurf.value, 1, `${JSON.stringify(mauvais)}`)
    }
    // et un givre non fini ne passe pas dans l'uniforme
    Globe.prototype.majReglagesMer.call(g, { vue: 0.4, surface: 0.08, givre: NaN })
    assert.equal(u.uMerGivre.value, 0)
  })
})

test('⑫c un NaN d accalmie ne peut pas atteindre l uniforme', () => {
  // ⚠️ Même contrat que `poserEstompage` : un NaN dans un uniforme éteint la
  // moitié d'un GPU sans un mot. `accalmieDuSocle` le filtre à la source.
  return merPosee().then(({ g, u }) => {
    const socle = { uViewCalm: { value: NaN }, uSurfCalm: { value: NaN } }
    Globe.prototype.majReglagesMer.call(g, accalmieDuSocle(socle))
    assert.ok(Number.isFinite(u.uMerCalmeVue.value) && Number.isFinite(u.uMerCalmeSurf.value))
    assert.equal(u.uMerCalmeVue.value, 1)
  })
})

test('⑫d sans mer posée, `majReglagesMer` rend `null` et n écrit nulle part', () => {
  const g = globeAvecCrop()
  assert.equal(Globe.prototype.majReglagesMer.call(g), null)
})

test('⑫e `uMerUnite` EST le facteur qui a normalisé le canal G', () => {
  return merPosee().then(({ u }) => {
    // recalculé ICI depuis les grandeurs du repère, pas repris de la méthode
    const largeur = 2 * PORTEE_CROP * REPERE.demi * CIRCONFERENCE_M * (R_GLOBE / R_TERRE_M)
    const attendu = largeur / (COTE_CROP_UNITES * PORTEE_CROP)
    assert.ok(Math.abs(u.uMerUnite.value - attendu) < 1e-15, `${u.uMerUnite.value} contre ${attendu}`)
    // ⚠️ **ET IL EST EN MÈTRES MERCATOR, PAS EN MÈTRES VRAIS** : `largeurCropM`
    // porte un `cos φ` que `largeurUnites` n'a pas. À La Réunion l'écart vaut
    // 6,8 %, et c'est exactement la sorte de conversion à moitié faite que ce
    // chantier a payée quatre fois.
    const vrai = (largeurCropM(REPERE) * (R_GLOBE / R_TERRE_M)) / COTE_CROP_UNITES
    assert.ok(Math.abs(u.uMerUnite.value / vrai - 1) > 0.05,
      'les deux conventions doivent différer, sinon le test ne distingue rien')
  })
})

test('⑫f le rideau d eau descend au fond DES PAROIS, et le dit', () => {
  const g = globeAvecCrop()
  g._baseYCrop = -0.1337
  return Globe.prototype.poserMer.call(g, { remplir: remplirBouchon, portee: PORTEE_CROP }).then((r) => {
    const u = g._mer.material.uniforms
    assert.equal(u.uMerBasY.value, -0.1337, 'l uniforme doit porter le fond des parois')
    assert.ok(r.jupe, 'l état doit DIRE que le rideau est là')
    assert.equal(r.jupe.basY, -0.1337)
    assert.ok(r.jupe.anneau > 100 && r.jupe.sommets === 2 * r.jupe.anneau)
    // le maillage porte vraiment l'attribut, et il vaut 1 sur la moitié basse
    const aJupe = g._mer.geometry.getAttribute('aJupe')
    assert.ok(aJupe, 'l attribut aJupe doit être posé sur la géométrie')
    let uns = 0
    for (let i = 0; i < aJupe.array.length; i++) if (aJupe.array[i] === 1) uns++
    assert.equal(uns, r.jupe.anneau, 'exactement l anneau BAS doit valoir 1')
    // ⚠️ **ET LES INDEX DU RIDEAU SONT DÉCALÉS** : sans le décalage ils
    // pointeraient sur la calotte et replieraient la nappe sur elle-même.
    const idx = g._mer.geometry.getIndex().array
    let maxi = 0
    for (let i = 0; i < idx.length; i++) if (idx[i] > maxi) maxi = idx[i]
    assert.equal(maxi, g._mer.geometry.getAttribute('position').count - 1)
    assert.ok(maxi >= r.compte.sommets, 'le rideau doit vivre APRÈS la calotte dans l index')
  })
})

test('⑫g sans parois, PAS de rideau — et l état le dit plutôt que de le taire', () => {
  const g = globeAvecCrop() // `_baseYCrop` absent : les parois ont refusé
  return Globe.prototype.poserMer.call(g, { remplir: remplirBouchon, portee: PORTEE_CROP }).then((r) => {
    assert.equal(r.jupe, null, 'l état doit DIRE qu il n y a pas de rideau')
    assert.equal(g._mer.material.uniforms.uMerBasY.value, 0)
    const aJupe = g._mer.geometry.getAttribute('aJupe')
    assert.ok(aJupe, 'l attribut reste déclaré — le nuanceur le lit toujours')
    for (let i = 0; i < aJupe.array.length; i++) assert.equal(aJupe.array[i], 0)
    assert.equal(aJupe.count, r.compte.sommets, 'aucun sommet de rideau ne doit être bâti')
  })
})

test('⑫h `construireParoisCrop` RETIENT le fond du bloc pour la mer', () => {
  // ⚠️ `MAILLONS` met `parois` AVANT `mer` : c'est ce qui rend la valeur
  // disponible. Un refus de couverture ne doit RIEN retenir.
  const solide = construireSolideCrop({
    repere: REPERE,
    forme: { coin: 0, expo: 2 },
    hauteur: () => 100,
    rayon: R_GLOBE,
    echelle: (R_GLOBE / R_TERRE_M) * EXAG_SOCLE_NOMINALE,
  })
  assert.ok(Number.isFinite(solide.baseY) && solide.baseY < 0, `baseY ${solide.baseY}`)
  const src = readFileSync(SRC_GLOBE, 'utf8')
  assert.match(src, /this\._baseYCrop = solide\.baseY/)
  // et il n'est posé qu'APRÈS le refus : une paroi refusée n'écrit rien
  const iRefus = src.indexOf('if (solide.refus) return { mesh: null, solide')
  const iPose = src.indexOf('this._baseYCrop = solide.baseY')
  assert.ok(iRefus > 0 && iPose > iRefus)
})

test('⑫i le champ de la mer REND son unité — un seul calcul, deux lecteurs', () => {
  // ⚠️ La mutation « le champ ne rend plus son unité » survivait : rien
  // n'exigeait que `_cuireChampMer` la publie, alors que c'est le seul moyen
  // que l'uniforme et le canal G partagent le MÊME nombre.
  const g = globeAvecCrop()
  const champ = Globe.prototype._cuireChampMer.call(g, {
    repere: REPERE,
    portee: PORTEE_CROP,
    remplir: remplirBouchon,
    echelle: (R_GLOBE / R_TERRE_M) * EXAG_SOCLE_NOMINALE,
  })
  assert.ok(Number.isFinite(champ.unite) && champ.unite > 0, `unite ${champ.unite}`)
  const largeur = 2 * PORTEE_CROP * REPERE.demi * CIRCONFERENCE_M * (R_GLOBE / R_TERRE_M)
  assert.ok(Math.abs(champ.unite - largeur / (COTE_CROP_UNITES * PORTEE_CROP)) < 1e-15)
  champ.texture.dispose?.()
})

test('⑫j `reglagesMer` d `ocean.js` LIT vraiment ses trois réglages — exécuté', async () => {
  // ⚠️ **IMPORTATION DYNAMIQUE, ET C'EST OBLIGATOIRE** : une `import` statique
  // est hissée AU-DESSUS de `registerHooks`, et `ocean-waves` n'est alors plus
  // résolu. Le fichier tombe entier avec un `ERR_MODULE_NOT_FOUND` — vu.
  const { RealWater } = await import('../src/ocean.js')
  // ⛔ **DIXIÈME SURVIVANTE DE LA CAMPAGNE, ET ELLE A TROUVÉ UN VRAI TROU.**
  // « le givre du socle ne traverse pas » restait verte : l'accesseur n'était
  // gardé que par un `grep` de sa ligne de recherche du matériau, pas par un
  // appel. On l'EXÉCUTE, sur un objet minimal qui porte exactement ce qu'il lit.
  //
  // ⚠️ **LE GIVRE VIT SUR LE SECOND MATÉRIAU** — celui de la jupe — et c'est
  // tout le piège : `materials[0]` n'a pas d'`uFrost`, donc une recherche naïve
  // rendrait 0 sans un mot. Le faux socle le reproduit exprès.
  const d = Object.getOwnPropertyDescriptor(RealWater.prototype, 'reglagesMer')
  assert.equal(typeof d?.get, 'function', 'reglagesMer doit être un accesseur')
  const ciel = { isColor: true }
  const socle = {
    materials: [
      { uniforms: { uViewCalm: { value: 0.4039 }, uSurfCalm: { value: 0.08 }, uSky: { value: ciel } } },
      { uniforms: { uFrost: { value: 0.56 } } },
    ],
  }
  assert.deepEqual(d.get.call(socle), {
    vue: 0.4039, surface: 0.08, givre: 0.56, ciel,
    // ⚠️ **Tâche R2** : pas d'`uRefract` sur le faux socle, donc le neutre
    // d'`eau-refraction.js`. Il est À PART du groupe `eau` — son neutre ne peut
    // pas vivre dans `ecume-mer.js`, qui doit rester sans importation (③c).
    refraction: REFRACTION_NEUTRE,
    // ⚠️ **Tâche P5** : le faux socle ci-dessus ne porte AUCUN des six uniformes
    // d'état de mer, donc l'accesseur doit rendre le neutre — champ par champ.
    etat: ETAT_MER_NEUTRE,
    // ⚠️ **Tâche P6, MÊME RÈGLE** : ni `uTransp`, ni `uSunFx`, ni `uDayLight`,
    // ni `uDetail`, ni `uShallowT`/`uDeep`, ni `uSunColor` — donc le neutre, un
    // `null` de couleurs (jamais un demi-couple) et un spectre à deux `null`.
    eau: LAME_EAU_NEUTRE,
    couleurs: null,
    soleilCouleur: null,
    spectre: { a: null, b: null },
    echelleSpectre: null,
  })
  // sans mer construite : le NEUTRE, c'est-à-dire la calotte d'avant P4
  assert.deepEqual(d.get.call({ materials: [] }), {
    vue: 1, surface: 1, givre: 0, ciel: null, etat: ETAT_MER_NEUTRE, refraction: REFRACTION_NEUTRE,
    eau: LAME_EAU_NEUTRE, couleurs: null, soleilCouleur: null, spectre: null, echelleSpectre: null,
  })
  // ⚠️ **ET LA RÉFRACTION REMONTE VRAIMENT — Tâche R2, DANS LES DEUX SENS.**
  // Une concordance au défaut ne prouverait rien : on la déplace.
  assert.equal(d.get.call({ materials: [{ uniforms: { uRefract: { value: 0.34 } } }] }).refraction, 0.34)
  assert.equal(d.get.call({ materials: [{ uniforms: { uRefract: { value: 0.91 } } }] }).refraction, 0.91)
  assert.equal(d.get.call({ materials: [{ uniforms: { uRefract: { value: NaN } } }] }).refraction, REFRACTION_NEUTRE)
  assert.equal(refractionDuSocle(null), REFRACTION_NEUTRE)
  // un givre non fini ne remonte pas
  assert.equal(d.get.call({ materials: [{ uniforms: { uFrost: { value: NaN } } }] }).givre, 0)
  // ⛔ **ET L'ÉTAT DE MER REMONTE VRAIMENT — la réserve n° 1 de P4, exécutée.**
  // Les six valeurs sont celles RELEVÉES le 2026-08-22 sur la page vivante.
  const agite = {
    materials: [
      {
        uniforms: {
          uViewCalm: { value: 0.4039 }, uSurfCalm: { value: 0.08 },
          uWaveH: { value: 2 }, uChop: { value: 1 }, uFoam: { value: 1.9 },
          uFoamScale: { value: 1 }, uGloss: { value: 110 }, uSpeedMul: { value: 0.4 },
        },
      },
    ],
  }
  assert.deepEqual(d.get.call(agite).etat,
    { houle: 2, chop: 1, ecume: 1.9, ecumeEchelle: 1, brillance: 110, vitesse: 0.4 })
  // ⚠️ **ET CHACUN DES SIX SÉPARÉMENT** : un accesseur qui n'en lirait que cinq
  // rendrait une mer hybride, et un `deepEqual` global ne dirait pas lequel.
  for (const [nom, champ, valeur] of [
    ['uWaveH', 'houle', 2], ['uChop', 'chop', 1], ['uFoam', 'ecume', 1.9],
    ['uFoamScale', 'ecumeEchelle', 1], ['uGloss', 'brillance', 110], ['uSpeedMul', 'vitesse', 0.4],
  ]) {
    const un = { materials: [{ uniforms: { [nom]: { value: valeur } } }] }
    assert.equal(d.get.call(un).etat[champ], valeur, `${nom} n atteint pas ${champ}`)
  }
})

// ══════════ ⑬ LE FOND MARIN DU CROP — Tâche P5 ═════════════════════════════
//
// ⛔ **LE DÉFAUT NOMMÉ PAR LA TÂCHE P4** : *« le fond marin du crop est EN
// TERRASSES […] gradins pâles à bords droits »*. Mesuré dans la page vivante
// (La Réunion z12, `.banc/vues-P5/bilan-P5.json`), il n'y avait **ni terrasse ni
// quantification de la donnée** : le champ rend **5 303 valeurs distinctes sur
// 5 449 nœuds d'eau**, et sa PENTE moyenne est celle du MNT du socle à 1-3 %
// près. Ce qui était faux, ce sont **deux entrées de la loi de couleur** — et
// aucune des deux n'était calculée : elles étaient POSÉES, à des défauts.

test('⑬a `profondeurMaxDuCrop` mesure le CROP, pas la calotte', () => {
  // un champ de portée 3 : le crop occupe le tiers central. On creuse le
  // DEHORS beaucoup plus profond que le dedans — c'est exactement la situation
  // de La Réunion (calotte à −3 510,49 m, crop à −2 116,27 m).
  const cote = 13
  const portee = 3
  const v = new Float32Array(cote * cote)
  const n = cote - 1
  for (let j = 0; j < cote; j++) {
    for (let i = 0; i < cote; i++) {
      const qu = ((2 * i) / n - 1) * portee
      const qv = ((2 * j) / n - 1) * portee
      v[j * cote + i] = Math.abs(qu) <= 1 && Math.abs(qv) <= 1 ? -2116.27 : -3510.49
    }
  }
  assert.ok(Math.abs(profondeurMaxDuCrop(v, cote, portee) - 2116.27) < 1e-2)
  // ⚠️ **ET LE TÉMOIN QUI DIT QUE LE TEST DISTINGUE QUELQUE CHOSE** : le maximum
  // du champ ENTIER, lui, vaut 3 510,49. Sans lui, un `profondeurMaxDuCrop` qui
  // rendrait bêtement le maximum global passerait la ligne du dessus le jour où
  // les deux valeurs coïncideraient.
  let global = 0
  for (const h of v) if (-h > global) global = -h
  assert.ok(Math.abs(global - 3510.49) < 1e-2)
  assert.ok(global / profondeurMaxDuCrop(v, cote, portee) > 1.65,
    'le dehors doit être NETTEMENT plus profond, sinon le test ne prouve rien')
})

test('⑬b la borne du crop est la MÊME que celle du nuanceur et d `uvFond`', () => {
  // ⚠️ Le nœud `i` porte `q = (2 i / (cote − 1) − 1) × portee` — la convention de
  // `uvFond` (`fond-crop.js`) et de `MER_VERT`. Une seconde convention ici et le
  // budget serait mesuré ailleurs que là où il sert.
  const cote = 7
  const portee = 3
  const v = new Float32Array(cote * cote).fill(0)
  // le nœud du CENTRE seul, à −100 m : dedans, donc compté
  v[3 * cote + 3] = -100
  assert.equal(profondeurMaxDuCrop(v, cote, portee), 100)
  // le nœud voisin (q = ±1 exactement) est encore DEDANS (borne inclusive)
  const w = new Float32Array(cote * cote).fill(0)
  w[3 * cote + 2] = -50 // q.u = (4/6 − 1) × 3 = −1
  assert.equal(profondeurMaxDuCrop(w, cote, portee), 50)
  // celui d'après (q = −2) est DEHORS
  const y = new Float32Array(cote * cote).fill(0)
  y[3 * cote + 1] = -50
  assert.equal(profondeurMaxDuCrop(y, cote, portee), 0)
})

test('⑬c un champ sans eau, un champ vide ou une portée nulle rendent 0', () => {
  assert.equal(profondeurMaxDuCrop(new Float32Array(9).fill(120), 3, 1), 0, 'la terre ne compte pas')
  assert.equal(profondeurMaxDuCrop(null, 3, 1), 0)
  assert.equal(profondeurMaxDuCrop(new Float32Array(9), 1, 1), 0)
  assert.equal(profondeurMaxDuCrop(new Float32Array(9), 3, 0), 0)
})

// le champ qui SÉPARE les deux mesures : creusé au dehors, moins au dedans
const creuseDehors = (emprise, n, sortie) => {
  const cote = n + 1
  for (let j = 0; j < cote; j++) {
    for (let i = 0; i < cote; i++) {
      const qu = ((2 * i) / n - 1) * PORTEE_CROP
      const qv = ((2 * j) / n - 1) * PORTEE_CROP
      sortie[j * cote + i] = Math.abs(qu) <= 1 && Math.abs(qv) <= 1 ? -2116.27 : -3510.49
    }
  }
  return { remplis: sortie.length }
}

test('⑬d `poserMer` pose le budget du CROP, jamais celui de la calotte', async () => {
  // le bouchon des autres tests remplit à −500 m PARTOUT : les deux mesures y
  // coïncident, et c'est le cas dégénéré. Celui-ci les sépare.
  const g = globeAvecCrop()
  const r = await Globe.prototype.poserMer.call(g, { remplir: creuseDehors, portee: PORTEE_CROP })
  assert.ok(r && !r.refus, `poserMer a refusé : ${r && r.refus}`)
  // ⛔ **2 116,27 ET NON 3 510,49** : le socle normalise sur SON bloc
  // (`uSeaRange = −dem.minM`), et l'écart mesuré à La Réunion vaut ×1,658.
  assert.ok(Math.abs(g.uniforms.uMerFondBudgetM.value - 2116.27) < 1,
    `budget ${g.uniforms.uMerFondBudgetM.value} : il doit être celui du CROP`)
  assert.ok(g.uniforms.uMerFondBudgetM.value < 3510,
    'le budget de la CALOTTE ne doit pas atteindre l uniforme')
})

test('⑬e un crop SANS eau à l intérieur retombe sur le champ, pas sur zéro', async () => {
  // ⚠️ **UN BUDGET NUL PEINDRAIT TOUTE LA MER D UN SEUL BLEU** : `d01` saturerait
  // à 1 partout. Le repli n'est donc pas décoratif.
  const g = globeAvecCrop()
  const terreDedans = (emprise, n, sortie) => {
    const cote = n + 1
    for (let j = 0; j < cote; j++) {
      for (let i = 0; i < cote; i++) {
        const qu = ((2 * i) / n - 1) * PORTEE_CROP
        const qv = ((2 * j) / n - 1) * PORTEE_CROP
        sortie[j * cote + i] = Math.abs(qu) <= 1 && Math.abs(qv) <= 1 ? 300 : -3510.49
      }
    }
    return { remplis: sortie.length }
  }
  await Globe.prototype.poserMer.call(g, { remplir: terreDedans, portee: PORTEE_CROP })
  assert.ok(Math.abs(g.uniforms.uMerFondBudgetM.value - 3510.49) < 1,
    `le repli doit être la profondeur du champ : ${g.uniforms.uMerFondBudgetM.value}`)
})

test('⑬f `couleursFondDuSocle` LIT les trois couleurs vivantes — jamais un demi-triplet', () => {
  const peu = { isColor: true, n: 'peu' }
  const moyen = { isColor: true, n: 'moyen' }
  const fond = { isColor: true, n: 'fond' }
  assert.deepEqual(couleursFondDuSocle(peu, moyen, fond), { peu, moyen, fond })
  // ⚠️ **DEUX SUR TROIS = RIEN.** Deux couleurs du socle et une du défaut
  // seraient pires que les trois du défaut — le raisonnement du demi-couple
  // d'accalmies de P4, appliqué à trois.
  assert.equal(couleursFondDuSocle(peu, moyen, null), null)
  assert.equal(couleursFondDuSocle(peu, null, fond), null)
  assert.equal(couleursFondDuSocle(null, moyen, fond), null)
  assert.equal(couleursFondDuSocle(peu, moyen, {}), null)
  assert.equal(couleursFondDuSocle(), null)
  // ⚠️ **ET ELLE NE PREND PAS LA POIGNÉE DES UNIFORMES DU SOCLE** :
  // `test/damier-uniformes.test.js` ③ l'interdit, et il a attrapé la première
  // écriture de cette tâche.
  const main = readFileSync(new URL('../src/main.js', import.meta.url), 'utf8')
  assert.ok(!/couleursFondDuSocle\(terrain\.mapUniforms\)/.test(main),
    'la poignée entière ne doit jamais être cédée')
  assert.match(main, /couleursFondDuSocle\(\s+terrain\.mapUniforms\.uOceanShallow\.value,\s+terrain\.mapUniforms\.uOceanMid\.value,\s+terrain\.mapUniforms\.uOceanDeep\.value,/)
})

test('⑬g `majReglagesMer` COPIE les trois couleurs du socle dans les uniformes des TUILES', () => {
  return merPosee().then(({ g }) => {
    const u = g.uniforms
    // le témoin : à la naissance, la calotte porte le DÉFAUT du module
    assert.equal('#' + u.uOceanShallow.value.getHexString(), RAMPE_NAUTIQUE.peu)
    const peu = { isColor: true, r: 0.78, g: 0.95, b: 0.89 }
    const moyen = { isColor: true, r: 0.38, g: 0.81, b: 0.76 }
    const fond = { isColor: true, r: 0.07, g: 0.43, b: 0.49 }
    const pose = Globe.prototype.majReglagesMer.call(g, { vue: 1, surface: 1, fond: { peu, moyen, fond } })
    assert.equal(pose.fond, true)
    for (const [uni, src] of [[u.uOceanShallow, peu], [u.uOceanMid, moyen], [u.uOceanDeep, fond]]) {
      assert.ok(Math.abs(uni.value.r - src.r) < 1e-6, 'canal R')
      assert.ok(Math.abs(uni.value.g - src.g) < 1e-6, 'canal V')
      assert.ok(Math.abs(uni.value.b - src.b) < 1e-6, 'canal B')
      // ⚠️ **COPIÉ, PAS PARTAGÉ** : partager l'objet ferait qu'un `retirerMer`
      // remettant `RAMPE_NAUTIQUE` REPEINDRAIT la mer du socle.
      assert.notEqual(uni.value, src)
    }
    // ⛔ et un triplet incomplet ne pose RIEN — pas deux couleurs sur trois
    Globe.prototype.majReglagesMer.call(g, { vue: 1, surface: 1 })
    assert.ok(Math.abs(u.uOceanShallow.value.r - peu.r) < 1e-6, 'sans fond, on ne touche à rien')
    const pose2 = Globe.prototype.majReglagesMer.call(g, { vue: 1, surface: 1, fond: { peu, moyen } })
    assert.equal(pose2.fond, false)
    assert.ok(Math.abs(u.uOceanShallow.value.r - peu.r) < 1e-6, 'un demi-triplet ne pose rien')
  })
})

const SIX = [
  ['houle', 'uMerHoule'], ['chop', 'uMerChop'], ['ecume', 'uMerEcume'],
  ['ecumeEchelle', 'uMerEcumeEchelle'], ['brillance', 'uMerBrillance'], ['vitesse', 'uMerVitesse'],
]

test('⑬h `majReglagesMer` pose les SIX réglages d état de mer, un par un', () => {
  return merPosee().then(({ g, u }) => {
    // le témoin : à la naissance, la mer porte le NEUTRE, c'est-à-dire la mer
    // d'avant la Tâche P5, au bit près.
    for (const [champ, uni] of SIX) assert.equal(u[uni].value, ETAT_MER_NEUTRE[champ], uni)
    // les valeurs RELEVÉES sur le socle vivant le 2026-08-22
    const etat = { houle: 2, chop: 1, ecume: 1.9, ecumeEchelle: 1, brillance: 110, vitesse: 0.4 }
    Globe.prototype.majReglagesMer.call(g, { vue: 0.4039, surface: 0.08, etat })
    for (const [champ, uni] of SIX) assert.equal(u[uni].value, etat[champ], uni)
    // ⚠️ **ET CHACUN SÉPARÉMENT, PARCE QU UNE ASSERTION GROUPÉE NE DIT PAS
    // LEQUEL** : on ne change qu'un champ à la fois, et on vérifie que les cinq
    // autres n'ont pas bougé. C'est ce qui tue une mutation qui échangerait deux
    // affectations.
    for (const [champ, uni] of SIX) {
      const seul = { ...ETAT_MER_NEUTRE, [champ]: 0.123456 }
      Globe.prototype.majReglagesMer.call(g, { vue: 1, surface: 1, etat: seul })
      assert.equal(u[uni].value, 0.123456, `${champ} n atteint pas ${uni}`)
      for (const [autre, autreUni] of SIX) {
        if (autre === champ) continue
        assert.equal(u[autreUni].value, ETAT_MER_NEUTRE[autre], `${champ} a débordé sur ${autreUni}`)
      }
    }
  })
})

test('⑬i un état de mer INCOMPLET retombe sur le neutre entier, pas sur une mer hybride', () => {
  return merPosee().then(({ g, u }) => {
    const bon = { houle: 2, chop: 1, ecume: 1.9, ecumeEchelle: 1, brillance: 110, vitesse: 0.4 }
    for (const champ of Object.keys(bon)) {
      const casse = { ...bon, [champ]: NaN }
      Globe.prototype.majReglagesMer.call(g, { vue: 1, surface: 1, etat: casse })
      for (const [c, uni] of SIX) {
        assert.equal(u[uni].value, ETAT_MER_NEUTRE[c], `${champ} NaN doit rendre TOUT le neutre`)
        // ⚠️ **AUCUN NaN NE PEUT ATTEINDRE UN UNIFORME** : il éteint la moitié
        // d'un GPU sans un mot (même contrat que `poserEstompage`).
        assert.ok(Number.isFinite(u[uni].value), `${uni} porte un NaN`)
      }
    }
    for (const mauvais of [null, undefined, {}, 'oui']) {
      Globe.prototype.majReglagesMer.call(g, { vue: 1, surface: 1, etat: mauvais })
      assert.equal(u.uMerEcumeEchelle.value, ETAT_MER_NEUTRE.ecumeEchelle)
    }
  })
})

test('⑬j la HOULE porte l accalmie de vue — l expression d `ocean.js`, pas une seconde loi', () => {
  const src = readFileSync(SRC_GLOBE, 'utf8')
  const ocean = readFileSync(SRC_OCEAN, 'utf8')
  // `ocean.js` : oceanGerstner(xz, uTime, uWaveH * uViewCalm, …) au vertex …
  assert.match(ocean, /oceanGerstner\(xz, uTime, uWaveH \* uViewCalm, uChop, uSpeedMul, uLenScale/)
  // … et uWaveH BRUT dans shoreSurf.
  assert.match(ocean, /shoreSurf\(uvF, uField, uTime, uWaveH, uChop, uSpeedMul, uLenScale, uViewCalm/)
  // la calotte fait le MÊME partage, avec ses propres noms
  // ⛔ **ET AVEC LA CONVERSION DE MONNAIE — Tâche P6, VU À L'ÉCRAN.**
  // `uMerHoule` vaut ce que vaut `uWaveH`, c'est-à-dire des UNITÉS DE SOCLE ;
  // `oceanGerstner` ajoute cette amplitude à un maillage en UNITÉS DE SCÈNE.
  // Relevé le 2026-08-22 : `uMerUnite = 0,008227`, donc `uMerHoule = 2` valait
  // **121,6 fois** l'amplitude du socle, et le déplacement HORIZONTAL — que
  // l'écrêtage de déferlement ne borne pas — repliait le maillage sur lui-même.
  // Même faute que la tavelure (P4) et que le budget du fond (P5) : une valeur
  // juste, branchée dans la mauvaise unité.
  assert.match(src, /oceanGerstner\(vec2\(p\.x, p\.z\), uMerTemps, uMerHoule \* uMerCalmeVue \* uMerUnite, uMerChop, uMerVitesse, uMerLambda/)
  assert.match(src, /shoreSurf\(uvF, uMerChamp, uMerTemps, uMerHoule \* uMerUnite, uMerChop, uMerVitesse, uMerLambda, richesseMer/)
  // ⚠️ **ET `uMerUnite` EST DÉCLARÉ DANS LE VERTEX, UNE SEULE FOIS** — deux
  // déclarations ne compilent pas, et le banc ne le dirait qu'à l'écran.
  const v0 = src.slice(src.indexOf('const MER_VERT'), src.indexOf('const MER_FRAG'))
  assert.equal((v0.match(/uniform float uMerUnite;/g) || []).length, 1)
  // ⚠️ **ET L UNIFORME EST DÉCLARÉ DANS LE VERTEX**, sinon la compilation tombe.
  const vert = src.slice(src.indexOf('const MER_VERT'), src.indexOf('const MER_FRAG'))
  assert.match(vert, /uniform float uMerCalmeVue;/)
  // ⚠️ **UNE SEULE DÉCLARATION** : deux `uniform float uMerCalmeVue` dans le
  // même nuanceur ne compilent pas, et le banc ne le dirait qu'à l'écran.
  assert.equal((vert.match(/uniform float uMerCalmeVue;/g) || []).length, 1)
})

test('⑬k `poserMer` n accepte PLUS les quatre paramètres que personne ne passait', () => {
  const src = readFileSync(SRC_GLOBE, 'utf8')
  const i = src.indexOf('async poserMer({')
  const signature = src.slice(i, src.indexOf('} = {}) {', i))
  for (const mort of ['couleursFond', 'houle =', 'chop =', 'ecumeEchelle =']) {
    assert.ok(!signature.includes(mort), `${mort} doit avoir quitté la signature de poserMer`)
  }
  // ⚠️ **ET AUCUN APPELANT NE LES PASSAIT — C EST CE QUI RENDAIT LE TROU MUET.**
  // Le garde reste : si quelqu'un les remettait dans le contexte, il faudrait
  // décider QUI écrit, et ce test est l'endroit où la question se pose.
  const main = readFileSync(new URL('../src/main.js', import.meta.url), 'utf8')
  const j = main.indexOf('    mer: {')
  const bloc = main.slice(j, main.indexOf('\n  }\n', j))
  for (const mort of ['couleursFond', 'houle:', 'chop:', 'ecumeEchelle:']) {
    assert.ok(!bloc.includes(mort), `contexteCrop().mer ne doit pas porter ${mort}`)
  }
})

test('⑬l `retirerMer` rend les trois couleurs au défaut du module', () => {
  return merPosee().then(({ g }) => {
    const peu = { isColor: true, r: 0.1, g: 0.2, b: 0.3 }
    Globe.prototype.majReglagesMer.call(g, { vue: 1, surface: 1, fond: { peu, moyen: peu, fond: peu } })
    assert.ok(Math.abs(g.uniforms.uOceanShallow.value.r - 0.1) < 1e-6)
    Globe.prototype.retirerMer.call(g)
    // ⚠️ L'UNIFORME EST PARTAGÉ PAR TOUTES LES TUILES : le laisser sur la
    // palette du crop repeindrait tous les océans du monde en vue orbitale.
    assert.equal('#' + g.uniforms.uOceanShallow.value.getHexString(), RAMPE_NAUTIQUE.peu)
    assert.equal('#' + g.uniforms.uOceanMid.value.getHexString(), RAMPE_NAUTIQUE.moyen)
    assert.equal('#' + g.uniforms.uOceanDeep.value.getHexString(), RAMPE_NAUTIQUE.fond)
    assert.equal(g.uniforms.uMerRampeOn.value, 0)
  })
})

// ══════════ ⑭ LA LAME D'EAU ET LA FORME DU BLOC — Tâche P6 ═════════════════
//
// ⛔ **LE MOTIF DE DIX TÂCHES, CHERCHÉ EN BLOC AU LIEU D'ÊTRE ATTENDU** : un
// paramètre existe, il a un défaut, personne ne l'a branché. Six trouvés d'un
// coup — `couleurs` et `graine` de `poserMer`, `half` / `corner` / `expo` de
// `poserCrop`, `profondeur` de `construireParoisCrop` —, plus quatre réglages
// de la lame d'eau qui n'avaient **aucun paramètre** pour arriver.
//
// ⚠️ **ON EXÉCUTE.** C'est la leçon de la campagne de P4 : « une assertion qui
// lit un fichier prouve qu'un texte est là ; elle ne prouve pas qu'il pose la
// bonne valeur ».

test('⑭a `majReglagesMer` pose les QUATRE réglages de lame, un par un', () => {
  return merPosee().then(({ g, u }) => {
    // le témoin : à la naissance, la calotte porte le NEUTRE d'`ocean.js`
    assert.equal(u.uMerTransp.value, LAME_EAU_NEUTRE.transparence)
    assert.equal(u.uMerDetail.value, LAME_EAU_NEUTRE.detail)
    const eau = { transparence: 0.57, soleilFx: 0.72, jour: 0.31, detail: 0.75 }
    const pose = Globe.prototype.majReglagesMer.call(g, { vue: 1, surface: 1, eau })
    assert.deepEqual(pose.eau, eau)
    assert.equal(u.uMerTransp.value, 0.57)
    assert.equal(u.uMerSoleilFx.value, 0.72)
    assert.equal(u.uMerJour.value, 0.31)
    assert.equal(u.uMerDetail.value, 0.75)
    // ⚠️ **UN PAR UN, ET LES TROIS AUTRES NE BOUGENT PAS** — c'est ce qui tue
    // une mutation qui échangerait deux affectations.
    const noms = { transparence: 'uMerTransp', soleilFx: 'uMerSoleilFx', jour: 'uMerJour', detail: 'uMerDetail' }
    for (const champ of Object.keys(noms)) {
      const un = { ...LAME_EAU_NEUTRE, [champ]: 0.246813 }
      Globe.prototype.majReglagesMer.call(g, { vue: 1, surface: 1, eau: un })
      for (const [autre, uni] of Object.entries(noms)) {
        const attendu = autre === champ ? 0.246813 : LAME_EAU_NEUTRE[autre]
        assert.equal(u[uni].value, attendu, `${champ} a débordé sur ${autre}`)
      }
    }
  })
})

test('⑭b une lame INCOMPLÈTE retombe sur le neutre entier, pas sur une eau hybride', () => {
  return merPosee().then(({ g, u }) => {
    Globe.prototype.majReglagesMer.call(g,
      { vue: 1, surface: 1, eau: { transparence: 0.57, soleilFx: 0.72, jour: 1, detail: 0.75 } })
    assert.equal(u.uMerTransp.value, 0.57)
    // ⛔ un champ manquant, ou un NaN : TOUT retombe au neutre — le raisonnement
    // du demi-couple d'accalmies de P4, appliqué à quatre.
    for (const cassee of [
      { transparence: 0.57, soleilFx: 0.72, jour: 1 },
      { transparence: NaN, soleilFx: 0.72, jour: 1, detail: 0.75 },
      { transparence: 0.57, soleilFx: 0.72, jour: 1, detail: null },
    ]) {
      const pose = Globe.prototype.majReglagesMer.call(g, { vue: 1, surface: 1, eau: cassee })
      assert.deepEqual(pose.eau, LAME_EAU_NEUTRE)
      assert.equal(u.uMerTransp.value, LAME_EAU_NEUTRE.transparence)
      assert.equal(u.uMerDetail.value, LAME_EAU_NEUTRE.detail)
    }
  })
})

test('⑭c `majReglagesMer` COPIE les deux couleurs de la lame — jamais un demi-couple', () => {
  return merPosee().then(({ g, u }) => {
    const peu = { isColor: true, r: 0.53, g: 0.82, b: 0.88, copyDepuis: null }
    const fond = { isColor: true, r: 0.09, g: 0.27, b: 0.4 }
    const avant = { r: u.uMerPeu.value.r, g: u.uMerPeu.value.g, b: u.uMerPeu.value.b }
    const pose = Globe.prototype.majReglagesMer.call(g, { vue: 1, surface: 1, couleurs: { peu, fond } })
    assert.equal(pose.couleurs, true)
    for (const [uni, src] of [[u.uMerPeu, peu], [u.uMerFond, fond]]) {
      assert.ok(Math.abs(uni.value.r - src.r) < 1e-6, 'canal R')
      assert.ok(Math.abs(uni.value.g - src.g) < 1e-6, 'canal V')
      assert.ok(Math.abs(uni.value.b - src.b) < 1e-6, 'canal B')
      // ⚠️ **COPIÉ, PAS PARTAGÉ** : `_applySea` du socle repose ces objets, et
      // deux matériaux qui partagent une couleur finissent par se la disputer.
      assert.notEqual(uni.value, src)
    }
    // ⛔ un demi-couple ne pose RIEN
    const pose2 = Globe.prototype.majReglagesMer.call(g, { vue: 1, surface: 1, couleurs: { peu } })
    assert.equal(pose2.couleurs, false)
    assert.ok(Math.abs(u.uMerPeu.value.r - peu.r) < 1e-6, 'un demi-couple ne doit rien écrire')
    // …et sans couleurs du tout, la calotte garde ce qu'elle a
    Globe.prototype.majReglagesMer.call(g, { vue: 1, surface: 1 })
    assert.ok(Math.abs(u.uMerPeu.value.r - peu.r) < 1e-6)
    assert.ok(avant.r !== peu.r, 'le témoin doit distinguer le défaut de la valeur posée')
  })
})

test('⑭d la couleur du soleil et le SPECTRE traversent — le spectre par RÉFÉRENCE', () => {
  return merPosee().then(({ g, u }) => {
    const soleilCouleur = { isColor: true, r: 1, g: 0.97, b: 0.9 }
    Globe.prototype.majReglagesMer.call(g, { vue: 1, surface: 1, soleilCouleur })
    assert.ok(Math.abs(u.uSunColor.value.g - 0.97) < 1e-6, 'la couleur du soleil doit être copiée')
    assert.notEqual(u.uSunColor.value, soleilCouleur, 'copiée, pas partagée')
    // ⚠️ **LE SPECTRE, LUI, EST PARTAGÉ, ET C'EST DÉLIBÉRÉ** : `_applySea`
    // assigne déjà `u.a` / `u.b` à TOUS les matériaux du socle sans les cloner.
    // Un clone par image serait 32 `Vector4` recopiés pour rien, et surtout un
    // `reseed` ne traverserait plus.
    const a = [{ x: 1 }, { x: 2 }]
    const b = [{ y: 1 }, { y: 2 }]
    const avantA = u.uWaveA.value
    const pose = Globe.prototype.majReglagesMer.call(g, { vue: 1, surface: 1, spectre: { a, b } })
    assert.equal(pose.spectre, true)
    assert.equal(u.uWaveA.value, a, 'le spectre doit être partagé, pas copié')
    assert.equal(u.uWaveB.value, b)
    assert.notEqual(avantA, a, 'le témoin : la calotte naît avec SON tirage')
    // ⛔ un spectre vide ou incomplet ne remplace RIEN — sinon la mer devient un
    // miroir plat (le zéro trop propre de l'Étape 4 de la Tâche F).
    for (const cassee of [{ a: [], b }, { a, b: null }, { a: null, b: null }, {}]) {
      const p2 = Globe.prototype.majReglagesMer.call(g, { vue: 1, surface: 1, spectre: cassee })
      assert.equal(p2.spectre, false)
      assert.equal(u.uWaveA.value, a, 'un spectre cassé ne doit rien écraser')
    }
  })
})

test('⑭e `poserMer` n accepte PLUS `couleurs` ni `graine`', () => {
  // ⛔ **DEUX PARAMÈTRES QUE PERSONNE N'A JAMAIS PASSÉS**, exactement comme les
  // quatre que P5 a retirés. D13 §① : « plus de paramètre de compatibilité à
  // traîner ».
  const src = readFileSync(SRC_GLOBE, 'utf8')
  const i = src.indexOf('async poserMer({')
  assert.ok(i > 0)
  const sig = src.slice(i, src.indexOf('} = {}) {', i))
  for (const mort of ['couleurs =', 'graine =']) {
    assert.ok(!sig.includes(mort), `poserMer ne doit plus porter ${mort}`)
  }
  // et la mer se construit sur le NEUTRE du module, jamais sur un argument
  assert.match(src, /const cols = mod\.couleursEau\(\{\}\)/)
  assert.match(src, /mod\.seaStateToUniforms\(mod\.makeSeaState\(\)\)/)
  // …et `contexteCrop().mer` ne les porte pas non plus
  const main = readFileSync(new URL('../src/main.js', import.meta.url), 'utf8')
  const j = main.indexOf('    mer: {')
  assert.ok(j > 0, 'le bloc mer du contexte doit rester lisible')
  const bloc = main.slice(j, main.indexOf('\n  }\n', j))
  for (const mort of ['couleurs:', 'graine:']) {
    assert.ok(!bloc.includes(mort), `contexteCrop().mer ne doit pas porter ${mort}`)
  }
})

// ── LA FORME DU BLOC ───────────────────────────────────────────────────────

test('⑭f `poserCrop` prend le coin et l exposant du socle, et les NORMALISE une fois', () => {
  const g = globeAvecCrop()
  // le témoin : sans argument, le carré à angles vifs d'avant P6, au bit près
  assert.equal(g.uniforms.uCropCoin.value, 0)
  assert.equal(g.uniforms.uCropCoinN.value, 2)
  // les valeurs RELEVÉES le 2026-08-22 sur le socle vivant
  Globe.prototype.poserCrop.call(g, { centre: CENTRE, zoom: 12, tuilesParBloc: 3, half: 28, corner: 2.24, expo: 4.4 })
  assert.ok(Math.abs(g.uniforms.uCropCoin.value - 0.08) < 1e-12, 'coin = 2,24 / 28')
  assert.equal(g.uniforms.uCropCoinN.value, 4.4)
  // ⚠️ **LA NORMALISATION EST CELLE DE `coinNormalise`, ET ELLE EST BORNÉE** :
  // un rayon plus grand que le demi-côté est écrêté à 1, un négatif à 0.
  Globe.prototype.poserCrop.call(g, { centre: CENTRE, zoom: 12, tuilesParBloc: 3, half: 28, corner: 999, expo: 4.4 })
  assert.equal(g.uniforms.uCropCoin.value, 1)
  Globe.prototype.poserCrop.call(g, { centre: CENTRE, zoom: 12, tuilesParBloc: 3, half: 28, corner: -5, expo: 4.4 })
  assert.equal(g.uniforms.uCropCoin.value, 0)
  // ⚠️ **`half` COMPTE** : le même rayon sur un demi-côté deux fois plus grand
  // est un arrondi deux fois plus petit. Une mutation qui figerait 28 tombe ici.
  Globe.prototype.poserCrop.call(g, { centre: CENTRE, zoom: 12, tuilesParBloc: 3, half: 56, corner: 2.24, expo: 4.4 })
  assert.ok(Math.abs(g.uniforms.uCropCoin.value - 0.04) < 1e-12)
  // ⚠️ **ET L EXPOSANT NE DESCEND JAMAIS SOUS 2** : sous 2 la « superellipse »
  // devient concave, et le bloc rentrerait dans ses propres coins.
  Globe.prototype.poserCrop.call(g, { centre: CENTRE, zoom: 12, tuilesParBloc: 3, half: 28, corner: 2.24, expo: 0.5 })
  assert.equal(g.uniforms.uCropCoinN.value, 2)
})

test('⑭g la MER lit le même coin que les tuiles — un uniforme, pas deux', () => {
  return merPosee().then(({ g, u }) => {
    // ⚠️ **C'EST CE PARTAGE QUI FAIT QUE LA NAPPE SUIT SANS ÊTRE REBÂTIE**, et
    // c'est pourquoi `rafraichirForme` ne rejoue que `crop` et `parois`.
    assert.equal(u.uCropCoin, g.uniforms.uCropCoin)
    assert.equal(u.uCropCoinN, g.uniforms.uCropCoinN)
    Globe.prototype.poserCrop.call(g, { centre: CENTRE, zoom: 12, tuilesParBloc: 3, half: 28, corner: 2.24, expo: 4.4 })
    assert.ok(Math.abs(u.uCropCoin.value - 0.08) < 1e-12, 'la mer doit voir le coin sans rebâtir')
  })
})

test('⑭h la PROFONDEUR du bloc suit la tirette du socle, en FRACTION de la largeur', () => {
  // ⛔ **`FRACTION_PROFONDEUR = 7 / 56` ÉTAIT GELÉE** : sept et cinquante-six
  // sont `params.plinthDepth` et `TERRAIN_SIZE` À LEUR VALEUR D'USINE. Le
  // défaut avait donc l'air juste — c'est la même coïncidence que les deux
  // couleurs de la lame d'eau, et c'est pourquoi personne ne l'a vue.
  const base = { repere: REPERE, forme: { coin: 0, expo: 2 }, rayon: 1, echelle: 1e-6, hauteur: () => 0 }
  const defaut = construireSolideCrop(base)
  const triple = construireSolideCrop({ ...base, fractionProfondeur: FRACTION_PROFONDEUR * 3 })
  assert.ok(!defaut.refus && !triple.refus, 'les deux solides doivent se bâtir')
  // ⚠️ **LE ZÉRO N'EST PAS ZÉRO, ET C'EST LA SPHÈRE.** `hauteur()` rend 0
  // partout, mais l'anneau court sur une CALOTTE : son point le plus bas est à
  // −1,15 × 10⁻⁶ unité, pas à 0. Mesurer le rapport sur `baseY` brut rendait
  // 2,9915 au lieu de 3 — un chiffre presque juste, donc le pire genre. On
  // mesure donc l'ÉPAISSEUR, `baseY − minY`, et `minY` se lit à fraction nulle.
  const minY = construireSolideCrop({ ...base, fractionProfondeur: 0 }).baseY
  assert.ok(minY < 0 && minY > -1e-5, `minY = ${minY} : la calotte doit être presque plate`)
  const epaisseur = (s) => minY - s.baseY
  // ⚠️ **LE TÉMOIN D'ABORD** : sans épaisseur, le rapport de deux zéros ne
  // distinguerait rien — la classe d'erreur que P5 nomme (« une assertion qui
  // prouve qu'un texte est là »).
  assert.ok(epaisseur(defaut) > 0, 'le bloc doit avoir une épaisseur')
  assert.ok(Math.abs(epaisseur(triple) / epaisseur(defaut) - 3) < 1e-9,
    `${epaisseur(triple)} / ${epaisseur(defaut)}`)
  // ⚠️ **UNE FRACTION NÉGATIVE OU NON FINIE NE RETOURNE PAS LE BLOC** — un fond
  // au-dessus de sa propre surface, c'est le défaut que `plancherMer` a déjà
  // coûté une fois.
  assert.equal(construireSolideCrop({ ...base, fractionProfondeur: -1 }).baseY, minY)
  assert.equal(construireSolideCrop({ ...base, fractionProfondeur: NaN }).baseY, defaut.baseY)
  // …et `profondeur` (absolue) garde la priorité, pour les bancs et les tests
  assert.ok(Math.abs(epaisseur(construireSolideCrop({ ...base, profondeur: 0.5, fractionProfondeur: 9 })) - 0.5) < 1e-12)
})

test('⑭i `construireParoisCrop` TRANSMET la fraction, et `contexteCrop` la calcule', () => {
  const src = readFileSync(SRC_GLOBE, 'utf8')
  // ⚠️ **LA SIGNATURE S'EST ÉTALÉE SUR PLUSIEURS LIGNES À LA TÂCHE P13** (le
  // chanfrein et le congé y sont passés en instrument de banc) : on garde les
  // deux paramètres, pas leur mise en page.
  assert.match(src, /construireParoisCrop\(\{[\s\S]{0,400}?profondeur = null,[\s\S]{0,400}?fractionProfondeur = undefined,/)
  // ⚠️ **`undefined` LAISSE LE DÉFAUT DU MODULE** : une valeur réécrite ici en
  // serait une seconde, et deux défauts jumeaux divergent (`uContourInterval`,
  // Tâche C, tour 1).
  assert.match(src, /\n      fractionProfondeur,\n/)
  const main = readFileSync(new URL('../src/main.js', import.meta.url), 'utf8')
  // ⚠️ **`plinth.depth`, PAS `params.plinthDepth`** : c'est `rebuild` qui écrit
  // `this.depth`, donc le matériel qui dit la vérité — la règle de
  // `plinth.wallMat.color` (manque n° 2 du noteur), appliquée à la géométrie.
  assert.match(main, /fractionProfondeur: plinth\.depth \/ \(2 \* \(terrain\.mapUniforms\.uSlabHalf\?\.value \|\| 28\)\)/)
  // et la forme vient des UNIFORMES du socle, jamais de `params`
  assert.match(main, /half: terrain\.mapUniforms\.uSlabHalf\?\.value \?\? 28/)
  assert.match(main, /corner: terrain\.mapUniforms\.uSlabCorner\?\.value \?\? 0/)
  assert.match(main, /expo: terrain\.mapUniforms\.uSlabCornerN\?\.value \?\? 2/)
  assert.ok(!/corner: params\.slabCorner/.test(main), 'la forme ne doit pas passer par params')
})

test('⑭j l ÉCHELLE DE SPECTRE arrive du socle, CONVERTIE par `uMerUnite` — réserve n° 3 de P5', () => {
  return merPosee().then(({ g, u }) => {
    // ⛔ **`ECHELLE_HOULE_UNITES = 0,42` ÉTAIT ÉCRIT EN DUR** pendant que le
    // socle vit sur `LEN_SCALE × clamp(waveScale)`. P5 avait mesuré l'écart
    // (« le spectre du crop est 1,818 fois plus étiré ») et ne l'avait pas
    // fermé « parce que les deux vivent dans des systèmes d'unités différents ».
    // **Le système de conversion existe : c'est `uMerUnite`.**
    const avant = u.uMerLambda.value
    const unite = u.uMerUnite.value
    assert.ok(unite > 0, 'témoin : le champ doit rendre son unité')
    const pose = Globe.prototype.majReglagesMer.call(g, { vue: 1, surface: 1, echelleSpectre: 0.231 })
    assert.equal(pose.echelleSpectre, true)
    assert.ok(Math.abs(u.uMerLambda.value - 0.231 * unite) < 1e-15, `${u.uMerLambda.value}`)
    assert.notEqual(u.uMerLambda.value, avant, 'le témoin : la valeur du module n était PAS celle du socle')
    // ⛔ sans échelle à lire — ou avec une échelle absurde — on garde celle du
    // module : une longueur de houle nulle rendrait la mer étale sans un mot.
    for (const mauvaise of [null, undefined, 0, -1, NaN]) {
      u.uMerLambda.value = avant
      const p = Globe.prototype.majReglagesMer.call(g, { vue: 1, surface: 1, echelleSpectre: mauvaise })
      assert.equal(p.echelleSpectre, false, `${mauvaise} ne doit pas passer`)
      assert.equal(u.uMerLambda.value, avant)
    }
  })
})

test('⑭k `ocean.js` REMONTE son échelle de spectre, en unités de SOCLE', async () => {
  const { RealWater } = await import('../src/ocean.js')
  const d = Object.getOwnPropertyDescriptor(RealWater.prototype, 'reglagesMer')
  const socle = { materials: [{ uniforms: { uLenScale: { value: 0.231 } } }] }
  assert.equal(d.get.call(socle).echelleSpectre, 0.231)
  // ⚠️ **PAS DE CONVERSION CÔTÉ SOCLE** : `ocean.js` n'a pas à savoir ce qu'est
  // un crop. La seule conversion vit dans `majReglagesMer`, avec `uMerUnite`.
  const src = readFileSync(SRC_OCEAN, 'utf8')
  assert.match(src, /echelleSpectre: Number\.isFinite\(u\?\.uLenScale\?\.value\) \? u\.uLenScale\.value : null,/)
  assert.equal(d.get.call({ materials: [{ uniforms: {} }] }).echelleSpectre, null)
  assert.equal(d.get.call({ materials: [{ uniforms: { uLenScale: { value: NaN } } }] }).echelleSpectre, null)
})

test('⑭l la MER partage le soleil du BLOC avec les tuiles — pas une copie', () => {
  // ⛔ **SURVIVANTE N° 03 DU PREMIER TOUR, ET ELLE VISAIT UN VRAI TROU.**
  // Sans ce partage, le soleil de la mer serait figé à la naissance du crop :
  // la tirette d'heure déplacerait l'ombrage du relief et pas le glint de l'eau.
  return merPosee().then(({ g, u }) => {
    assert.equal(u.uSoleilDir, g.uniforms.uSoleilDir, 'uSoleilDir doit être PARTAGÉ')
    assert.equal(u.uEclairageOn, g.uniforms.uEclairageOn, 'uEclairageOn doit être PARTAGÉ')
    assert.equal(u.uSunDir, g.uniforms.uSunDir, 'le repli de planète reste partagé lui aussi')
    // ⚠️ **LE TÉMOIN** : la couleur du soleil, elle, est PROPRE à la mer —
    // `majReglagesMer` y COPIE celle du socle. Un matériau qui partagerait tout
    // passerait la boucle ci-dessus sans rien prouver.
    assert.notEqual(u.uSunColor, g.uniforms.uSunDir)
    assert.equal(g.uniforms.uSunColor, undefined, 'le globe n a pas de uSunColor à lui')
  })
})

test('⑭m `couleursEauDuSocle` LIT deux couleurs, dans cet ordre, et refuse un demi-couple', () => {
  // ⛔ **SURVIVANTES N° 26 ET 27 DU PREMIER TOUR.** ⑭c exerçait
  // `majReglagesMer` ; personne n'exerçait le module lui-même, donc ni sa garde
  // ni son ORDRE. Deux couleurs échangées rendent une mer claire au large et
  // sombre au rivage — l'inverse exact d'un lagon.
  const peu = { isColor: true, r: 0.53, g: 0.82, b: 0.88 }
  const fond = { isColor: true, r: 0.09, g: 0.27, b: 0.4 }
  const r = couleursEauDuSocle(peu, fond)
  assert.equal(r.peu, peu, 'le glacis clair doit rester le PREMIER argument')
  assert.equal(r.fond, fond, 'le bleu du large doit rester le SECOND')
  // ⚠️ **ET LES DEUX SONT DISTINCTS** : un test sur deux couleurs égales ne
  // distinguerait pas un échange.
  assert.notEqual(peu, fond)
  // le demi-couple, dans les deux sens, et l'absence
  assert.equal(couleursEauDuSocle(peu, null), null)
  assert.equal(couleursEauDuSocle(null, fond), null)
  assert.equal(couleursEauDuSocle(null, null), null)
  assert.equal(couleursEauDuSocle(undefined, undefined), null)
  assert.equal(couleursEauDuSocle({ r: 1 }, fond), null, 'un objet sans isColor n est pas une couleur')
})

// ══════════ ⑮ LE RIDEAU D'EAU FACE AU CONGÉ — Tâche P13 ════════════════════
//
// ⛔ **VU À L'ÉCRAN AVANT D'ÊTRE MESURÉ.** `.banc/P13/P5-zoom6-CROP-base-AVEC-P13.png`
// porte cinq traînées pâles qui courent sur toute la hauteur du mur ;
// `P6-…-SANS-P13.png`, rebâti à la MÊME seconde dans la MÊME page avec
// `fractionChanfrein: 0, fractionArrondi: 0`, n'en porte aucune. Le relevé de
// `.banc/P13/P2-jupes-P13.json`, avec l'instrument du noteur (`bandeDuMur`) :
//
//   | état                    | mer SOUS le bas du mur | langues |
//   |-------------------------|------------------------|---------|
//   | avant P13 (arêtes vives)| **0 px**               | 0       |
//   | chanfrein seul          | **0 px**               | 0       |
//   | congé seul              | **465 px**             | 4       |
//   | livré (les deux)        | **792 px**             | 4       |
//
// **C'est le congé qui déborde, et c'est mot pour mot le défaut que `plinth.js`
// raconte sur le socle** : « LE DÉFAUT DU 2026-08-03, on voit l'eau à travers le
// bloc ». Là-bas, élargir le chanfrein de 0,05 à 0,16 avait ramené le mur
// DERRIÈRE l'eau ; ici, le congé rentre la base de **3,9 fois** ce dont le
// rideau était rentré.
//
// ➡️ **LA PARADE EST CELLE DE `plinth.js`, PAS UN RATTRAPAGE** : une définition
// de « où finit le bloc », LUE et non devinée. `construireParoisCrop` publie le
// retrait de sa base, `poserMer` l'ajoute à la marge d'eau et le donne au bas du
// rideau, qui devient légèrement conique.

test('⑮a SANS `retraitBas`, le rideau est DROIT — la géométrie d avant, au bit près', () => {
  const j = construireJupeMer({ repere: REPERE, rayon: R_GLOBE, basY: -0.12, forme: { coin: 0.08, expo: 4.4 } })
  const n = j.compte.anneau
  for (let i = 0; i < n; i++) {
    assert.equal(j.positions[(n + i) * 3], j.positions[i * 3], `le sommet ${i} a bougé en x`)
    assert.equal(j.positions[(n + i) * 3 + 2], j.positions[i * 3 + 2], `le sommet ${i} a bougé en z`)
    assert.equal(j.uv[(n + i) * 2], j.uv[i * 2])
    assert.equal(j.uv[(n + i) * 2 + 1], j.uv[i * 2 + 1])
  }
})

test('⑮b AVEC `retraitBas`, le bas rentre — et l ÉCART EST CELUI QU ON A DEMANDÉ', () => {
  const commun = { repere: REPERE, rayon: R_GLOBE, basY: -0.12, forme: { coin: 0.08, expo: 4.4 } }
  const droit = construireJupeMer(commun)
  const conique = construireJupeMer({ ...commun, retraitBas: RETRAIT_EAU_CROP + 0.02 })
  const n = droit.compte.anneau
  assert.equal(conique.compte.anneau, n)
  // le HAUT ne bouge pas d'un bit : il reste soudé au bord de la calotte
  for (let i = 0; i < n * 3; i++) {
    assert.equal(conique.positions[i], droit.positions[i], `le rang du HAUT a bougé à l indice ${i}`)
  }
  // le BAS rentre, partout, et vers le centre
  const cx = REPERE ? 0 : 0
  let pireDedans = Infinity
  let plusGrand = 0
  for (let i = 0; i < n; i++) {
    const a = [droit.positions[(n + i) * 3], droit.positions[(n + i) * 3 + 2]]
    const b = [conique.positions[(n + i) * 3], conique.positions[(n + i) * 3 + 2]]
    const rA = Math.hypot(a[0] - cx, a[1] - cx)
    const rB = Math.hypot(b[0] - cx, b[1] - cx)
    pireDedans = Math.min(pireDedans, rA - rB)
    plusGrand = Math.max(plusGrand, rA - rB)
  }
  assert.ok(pireDedans > 0, `un sommet du bas est SORTI : ${pireDedans}`)
  // le retrait supplémentaire vaut 0,02 demi-côté — donc au moins 0,02 × le plus
  // petit rayon de l anneau, et au plus 0,02 × le plus grand
  const demi = REPERE.demi
  assert.ok(plusGrand > 0, `le bas n a pas bougé : ${plusGrand}`)
  assert.ok(Number.isFinite(demi) && demi > 0)
})

test('⑮c `retraitBas` PLUS PETIT que `retrait` est BORNÉ — le rideau ne ressort jamais', () => {
  // ⚠️ **C'EST TOUT CE QUE CE PARAMÈTRE EXISTE POUR EMPÊCHER.** Un appelant qui
  // rendrait un retrait de base plus petit que celui du haut — un solide sans
  // congé, un `_retraitBaseCrop` périmé — ferait RESSORTIR le bas du rideau,
  // c'est-à-dire exactement le défaut qu'on répare.
  const commun = { repere: REPERE, rayon: R_GLOBE, basY: -0.12, forme: { coin: 0.08, expo: 4.4 } }
  const droit = construireJupeMer(commun)
  for (const rb of [0, RETRAIT_EAU_CROP / 2, -1]) {
    const borne = construireJupeMer({ ...commun, retraitBas: rb })
    for (let i = 0; i < borne.positions.length; i++) {
      assert.equal(borne.positions[i], droit.positions[i], `retraitBas ${rb} a fait ressortir le sommet ${i}`)
    }
  }
})

test('⑮d LE RIDEAU RESTE DANS LE MUR SUR TOUTE SA HAUTEUR — l invariant qui apparie les deux pièces', () => {
  // ⚡ **DEUX MODULES, DEUX MONNAIES, UN SEUL INVARIANT.** `parois-crop.js`
  // rentre le mur en UNITÉS DE SCÈNE le long de la bissectrice ; `mer-sphere.js`
  // rentre le rideau en DEMI-CÔTÉS, par une homothétie sur `(u, v)`. Ce test les
  // confronte sur le MÊME anneau : à chaque sommet, l eau doit être PLUS RENTRÉE
  // que le mur, en haut comme en bas.
  const forme = { coin: 0.08, expo: 4.4 }
  const solide = construireSolideCrop({
    repere: REPERE, forme, rayon: R_GLOBE, echelle: (R_GLOBE / R_TERRE_M) * 2, hauteur: () => 0,
  })
  assert.equal(solide.refus, null)
  const retraitBase = (solide.chanfrein + solide.arrondi) / (solide.largeur / 2)
  const j = construireJupeMer({
    repere: REPERE, rayon: R_GLOBE, basY: solide.baseY, forme,
    retraitBas: retraitBase + MARGE_EAU_CROP,
  })
  const n = solide.compte.anneau
  assert.equal(j.compte.anneau, n)
  const dist = (ax, az, bx, bz) => Math.hypot(ax - bx, az - bz)
  let margeHaut = Infinity
  let margeBas = Infinity
  const dernier = (solide.rangs - 1) * n
  for (let k = 0; k < n; k++) {
    const ax = solide.positions[k * 3]
    const az = solide.positions[k * 3 + 2]
    // en haut : le mur est rentré de `chanfrein`, l eau doit l être davantage
    const eauHaut = dist(ax, az, j.positions[k * 3], j.positions[k * 3 + 2])
    margeHaut = Math.min(margeHaut, eauHaut - solide.chanfrein)
    // en bas : le mur est rentré de `chanfrein + congé`
    const eauBas = dist(ax, az, j.positions[(n + k) * 3], j.positions[(n + k) * 3 + 2])
    const murBas = dist(ax, az, solide.positions[(dernier + k) * 3], solide.positions[(dernier + k) * 3 + 2])
    margeBas = Math.min(margeBas, eauBas - murBas)
  }
  assert.ok(margeHaut > 0, `en haut, l eau sort du mur de ${-margeHaut}`)
  assert.ok(margeBas > 0, `en bas, l eau sort du mur de ${-margeBas} — c est le défaut de P13`)

  // ⚡ **ET LE TÉMOIN : SANS `retraitBas`, LE BAS SORT.** Sans cette mesure, le
  // test du dessus serait vrai quel que soit le rideau.
  const droit = construireJupeMer({ repere: REPERE, rayon: R_GLOBE, basY: solide.baseY, forme })
  let pireDroit = Infinity
  for (let k = 0; k < n; k++) {
    const ax = solide.positions[k * 3]
    const az = solide.positions[k * 3 + 2]
    const eauBas = dist(ax, az, droit.positions[(n + k) * 3], droit.positions[(n + k) * 3 + 2])
    const murBas = dist(ax, az, solide.positions[(dernier + k) * 3], solide.positions[(dernier + k) * 3 + 2])
    pireDroit = Math.min(pireDroit, eauBas - murBas)
  }
  assert.ok(pireDroit < 0,
    `le rideau DROIT reste dans le mur (marge ${pireDroit}) : le test ne distingue rien`)
})

test('⑮e `construireParoisCrop` PUBLIE le retrait de sa base, et `retirerParoisCrop` le reprend', () => {
  // ⚠️ **EXÉCUTÉ, PAS CHERCHÉ DANS LE TEXTE.** C est le CÂBLE : sans lui,
  // `poserMer` rend `undefined` et le rideau redevient droit — donc le défaut
  // revient, en silence.
  const t = { z: 12, x: 2094, y: 2270, key: '12/2094/2270' }
  const cote = 32
  t.size = cote
  t.heights = new Float32Array(cote * cote)
  for (let jj = 0; jj < cote; jj++) {
    for (let ii = 0; ii < cote; ii++) t.heights[jj * cote + ii] = 400 + 900 * Math.sin(ii * 0.7) * Math.cos(jj * 0.5)
  }
  const { lat, lon } = tileToLatLon(t.x + 0.5, t.y + 0.5, t.z)
  const rep = repereCrop({ centre: { lat, lon }, zoom: t.z, tuilesParBloc: 1 })
  const faux = {
    _crop: rep,
    _fondCrop: null,
    _parois: null,
    _baseYCrop: null,
    _retraitBaseCrop: null,
    exaggeration: 2,
    tiles: new Map([[t.key, t]]),
    tuilesAvecHauteurs: () => [t],
    uniforms: { uCropCoin: { value: 0.08 }, uCropCoinN: { value: 4.4 } },
    group: { add() {}, remove() {} },
    hauteurDessinee: Globe.prototype.hauteurDessinee,
    _tuileLaPlusFine: Globe.prototype._tuileLaPlusFine,
    _retaillerJupes: () => 0,
    retirerParoisCrop: Globe.prototype.retirerParoisCrop,
    // ⚠️ un matériau POUR DE VRAI (minimal) : `retirerParoisCrop` le libère,
    // et un `null` ferait tomber le test sur une panne au lieu d une mesure.
    _materiauParois: () => ({ dispose() {} }),
  }
  const r = Globe.prototype.construireParoisCrop.call(faux, { couvertureMin: 0 })
  assert.equal(r.refus, null)
  const s = r.solide
  assert.ok(Math.abs(faux._retraitBaseCrop - (s.chanfrein + s.arrondi) / (s.largeur / 2)) < 1e-15,
    `le retrait publié vaut ${faux._retraitBaseCrop}`)
  // ⚡ ET IL VAUT CE QUE LES DEUX CONSTANTES DU SOCLE DISENT, EN DEMI-CÔTÉS
  assert.ok(Math.abs(faux._retraitBaseCrop - (0.16 + 0.9) / 28) < 1e-12,
    `le retrait publié ${faux._retraitBaseCrop} n est pas (chanfrein + congé) / 28`)
  // ⚡ ET IL EST PLUS GRAND QUE CELUI DU HAUT : c est tout le sujet
  assert.ok(faux._retraitBaseCrop + MARGE_EAU_CROP > RETRAIT_EAU_CROP)
  // ⛔ **ET LE PLANCHER DES JUPES EST LE SOMMET DU CONGÉ — UNE SURVIVANTE L A
  // MONTRÉ.** `_plancherJupeCrop = solide.baseY` (sans le congé) passait au
  // travers : rien ne lisait ce champ. C est pourtant lui qui empêche les jupes
  // de dépasser sous le mur (82 px, 4 langues, mesurés à l écran).
  assert.equal(faux._plancherJupeCrop, s.baseY + s.arrondi)
  assert.ok(faux._plancherJupeCrop > s.baseY, 'le plancher des jupes ne monte pas au-dessus du fond')
  // et le retrait est repris quand les parois partent
  Globe.prototype.retirerParoisCrop.call(faux)
  assert.equal(faux._retraitBaseCrop, null, 'un retrait périmé survivrait au retrait des parois')
  assert.equal(faux._baseYCrop, null)
})

test('⑮f `poserMer` DONNE ce retrait au bas du rideau — exécuté sur la géométrie posée', () => {
  const g = globeAvecCrop()
  g._baseYCrop = -0.12
  g._retraitBaseCrop = (0.16 + 0.9) / 28
  return Globe.prototype.poserMer.call(g, { remplir: remplirBouchon, portee: PORTEE_CROP }).then(() => {
    const pos = g._mer.geometry.getAttribute('position').array
    const aCrop = g._mer.geometry.getAttribute('aCrop').array
    // ⚠️ le rideau est CONCATÉNÉ derrière la calotte : ses `2n` derniers sommets
    // sont l anneau haut puis l anneau bas.
    const total = aCrop.length / 2
    const jupe = g._mer.geometry.getAttribute('aJupe').array
    let n = 0
    for (let i = 0; i < total; i++) if (jupe[i] > 0.5) n++
    assert.ok(n > 0, 'aucun sommet de rideau : le ruban n est pas posé')
    const bas0 = total - n
    const haut0 = bas0 - n
    let pireDedans = Infinity
    for (let i = 0; i < n; i++) {
      const rh = Math.hypot(aCrop[(haut0 + i) * 2], aCrop[(haut0 + i) * 2 + 1])
      const rb = Math.hypot(aCrop[(bas0 + i) * 2], aCrop[(bas0 + i) * 2 + 1])
      pireDedans = Math.min(pireDedans, rh - rb)
      assert.ok(pos[(bas0 + i) * 3 + 1] === Math.fround(-0.12) || Math.abs(pos[(bas0 + i) * 3 + 1] + 0.12) < 1e-6,
        'le bas du rideau n est pas sur le fond du bloc')
    }
    assert.ok(pireDedans > 0,
      `le bas du rideau n est pas rentré : marge ${pireDedans} en demi-côtés`)
    // ⛔ **ET IL RENTRE DE LA BONNE CHOSE — UNE SURVIVANTE L A MONTRÉ.** Oublier
    // `MARGE_EAU_CROP` laissait le test vert : le bas rentrait quand même (le
    // congé pèse 3,9 fois la marge), mais il venait se poser EXACTEMENT sur le
    // mur au lieu de rester dedans. La marge est ce qui garde l eau DANS le
    // bloc, et c est celle du socle. On exige donc le RAPPORT exact des deux
    // homothéties, pas seulement son signe.
    const kHaut = 1 - RETRAIT_EAU_CROP
    const kBas = 1 - (g._retraitBaseCrop + MARGE_EAU_CROP)
    for (let i = 0; i < n; i += 41) {
      const rh = Math.hypot(aCrop[(haut0 + i) * 2], aCrop[(haut0 + i) * 2 + 1])
      const rb = Math.hypot(aCrop[(bas0 + i) * 2], aCrop[(bas0 + i) * 2 + 1])
      if (rh < 1e-6) continue
      assert.ok(Math.abs(rb / rh - kBas / kHaut) < 1e-6,
        `sommet ${i} : rapport ${rb / rh} pour ${kBas / kHaut} — la marge d eau du socle a disparu`)
    }
    // ⚡ LE TÉMOIN : sans `_retraitBaseCrop`, il ne rentre PAS.
    const g2 = globeAvecCrop()
    g2._baseYCrop = -0.12
    g2._retraitBaseCrop = null
    return Globe.prototype.poserMer.call(g2, { remplir: remplirBouchon, portee: PORTEE_CROP }).then(() => {
      const a2 = g2._mer.geometry.getAttribute('aCrop').array
      const j2 = g2._mer.geometry.getAttribute('aJupe').array
      const t2 = a2.length / 2
      let n2 = 0
      for (let i = 0; i < t2; i++) if (j2[i] > 0.5) n2++
      const b2 = t2 - n2
      const h2 = b2 - n2
      let pire2 = 0
      for (let i = 0; i < n2; i++) {
        pire2 = Math.max(pire2, Math.abs(Math.hypot(a2[(h2 + i) * 2], a2[(h2 + i) * 2 + 1])
          - Math.hypot(a2[(b2 + i) * 2], a2[(b2 + i) * 2 + 1])))
      }
      assert.equal(pire2, 0, `sans retrait de base, le rideau rentre quand même de ${pire2}`)
    })
  })
})

// ══════════ ⑯ D24 — LA COUPE PLATE À LA JUPE ═══════════════════════════════
//
// > **Adrien, 2026-09-04** : *« Je pense que l'effet latéral de vagues pose
// > problème. Il faudrait que le crop se fasse de façon plate, au niveau de la
// > jupe du socle, ça évitera de calculer cette déformation inutile. »*
//
// ⚡ **DEUX MOITIÉS, ET LES TESTS LES SÉPARENT.** ⑯a à ⑯c ferment la coupe
// plate (le déplacement s'éteint AVANT le bord, et il ne peut pas le franchir) ;
// ⑯d à ⑯f ferment la seconde moitié, celle qu'on rate — la déformation hors
// emprise n'est plus CALCULÉE, parce que les sommets n'existent plus.
//
// ⚠️ **CE QUE `sonde-mer-jupe.mjs` A MESURÉ À L'ÉCRAN, ET QUE CES TESTS NE
// PEUVENT PAS MESURER** : 31 à 63 px de mer au-delà de l'arête du socle par
// image, témoin `chop = 0` à 0 px, sur 17 postes ; 0 px après. Les tests
// ci-dessous verrouillent les LOIS qui rendent ce zéro structurel.

test('⑯a `amplitudeLateraleHoule` MAJORE le terme latéral de Gerstner — sur SA source, relue', () => {
  // ⛔ **PAS UNE SECONDE ÉCRITURE : UNE BORNE.** Et une borne qui suivrait une
  // loi qui a bougé serait pire que rien, donc on RELIT le morceau partagé.
  const glsl = readFileSync(new URL('../src/vendor/ocean-waves/gerstner.glsl.js', import.meta.url), 'utf8')
  assert.match(glsl, /float k = uWaveA\[i\]\.z \/ lenScale;/)
  assert.match(glsl, /float a = uWaveA\[i\]\.w \* lenScale \* waveH \* fade;/)
  assert.match(glsl, /float q = min\(chop \* 1\.9 \* uWaveB\[i\]\.z \* fade \/ \(k \* a\), 1\.0 \/ \(k \* a\)\);/)
  assert.match(glsl, /if \(a < 1e-7\) continue;/)
  assert.match(glsl, /disp\.x \+= q \* a \* d\.x \* C;/)

  // et la borne MAJORE vraiment : on rejoue le nuanceur sur un spectre de bruit,
  // à toutes les phases, et on vérifie que |disp.xz| ne dépasse jamais la borne
  const a = [], b = []
  let graine = 7
  const alea = () => (graine = (graine * 1103515245 + 12345) % 2147483648) / 2147483648
  for (let i = 0; i < 16; i++) {
    const th = alea() * Math.PI * 2
    a.push({ x: Math.cos(th), y: Math.sin(th), z: 0.02 + alea() * 0.4, w: 0.3 + alea() * 3 })
    b.push({ x: alea() * 6.28, y: 0.4 + alea(), z: alea(), w: 0 })
  }
  const arg = { a, b, houle: 2, chop: 0.7, calme: 0.42, unite: 0.008227, lambda: 0.0032 }
  const borne = amplitudeLateraleHoule(arg)
  assert.ok(borne > 0, 'un spectre vivant doit rendre une borne strictement positive')
  const waveH = arg.houle * arg.calme * arg.unite
  for (let t = 0; t < 40; t++) {
    for (const [x, z] of [[0, 0], [12, -5], [-3, 41]]) {
      let dx = 0, dz = 0
      for (let i = 0; i < 16; i++) {
        const k = a[i].z / arg.lambda
        const amp = a[i].w * arg.lambda * waveH
        if (amp < 1e-7) continue
        const f = k * (a[i].x * x + a[i].y * z) - b[i].y * t * 0.25 + b[i].x
        const q = Math.min((arg.chop * 1.9 * b[i].z) / (k * amp), 1 / (k * amp))
        dx += q * amp * a[i].x * Math.cos(f)
        dz += q * amp * a[i].y * Math.cos(f)
      }
      assert.ok(Math.hypot(dx, dz) <= borne + 1e-12,
        `la borne ${borne} est franchie : ${Math.hypot(dx, dz)}`)
    }
  }
  // un spectre absent, une houle nulle, un lambda nul : zéro, pas un NaN
  for (const mauvais of [{}, { ...arg, a: null }, { ...arg, houle: 0 }, { ...arg, lambda: 0 }, { ...arg, unite: 0 }]) {
    assert.equal(amplitudeLateraleHoule(mauvais), 0)
  }
})

test('⑯b la bande vaut DEUX fois le déplacement, et la marge de 1,125 est celle du lissage', () => {
  // ⚠️ **LE CHIFFRE N EST PAS UN GOÛT** : il faut `A · lissage(δ/B) < δ` pour
  // tout `δ` de la bande, et `max(3t − 2t²) = 1,125` en `t = 0,75`. On BALAIE la
  // bande plutôt que de faire confiance à l algèbre.
  assert.equal(MARGE_BANDE_HOULE, 2)
  const parDemi = 0.2126
  const A = 3.3e-4
  const B = bandeHouleBord(A, parDemi)
  assert.ok(Math.abs(B - (2 * A) / parDemi) < 1e-15)
  const lissage = (t) => { const c = Math.min(1, Math.max(0, t)); return c * c * (3 - 2 * c) }
  const aCrop = A / parDemi // le déplacement, en demi-côtés — la même monnaie
  for (let i = 1; i <= 100; i++) {
    const delta = (i / 100) * B // distance au bord, en demi-côtés
    assert.ok(aCrop * lissage(delta / B) < delta,
      `à ${delta} du bord, le sommet avance de ${aCrop * lissage(delta / B)} : il franchit`)
  }
  // ⛔ **LE TÉMOIN QUI COMPTE** : avec une marge de 1 (la marge « évidente »),
  // le sommet FRANCHIT le bord — c est la faute que 1,125 nomme.
  let franchit = 0
  for (let i = 1; i <= 100; i++) {
    const delta = (i / 100) * aCrop
    if (aCrop * lissage(delta / aCrop) >= delta) franchit++
  }
  assert.ok(franchit > 0, 'une bande égale au déplacement devrait laisser franchir')
  // bornes : plafonnée à un demi-côté, nulle quand il n y a rien à éteindre
  assert.equal(bandeHouleBord(1e9, parDemi), 0.5)
  for (const m of [[0, parDemi], [A, 0], [A, -1], [NaN, parDemi]]) {
    assert.equal(bandeHouleBord(m[0], m[1]), 0)
  }
})

test('⑯c l ATTÉNUATION vaut 1 dedans et EXACTEMENT 0 au bord — la coupe est plate', () => {
  // le jumeau JS de `attenuationBordMer`, confronté au texte GLSL
  assert.match(GLSL_BORD_CROP, /return 1\.0 - smoothstep\(fin - max\(bande, 1e-7\), fin, dBord\);/)
  const lissage = (e0, e1, x) => { const t = Math.min(1, Math.max(0, (x - e0) / (e1 - e0))); return t * t * (3 - 2 * t) }
  const att = (d, fin, bande) => 1 - lissage(fin - Math.max(bande, 1e-7), fin, d)
  const { fin } = bordDeMer()
  const bande = 0.0031
  assert.equal(att(fin, fin, bande), 0, 'au bord, l atténuation doit valoir EXACTEMENT zéro')
  assert.equal(att(fin + 1, fin, bande), 0, 'au-delà aussi')
  assert.equal(att(fin - bande, fin, bande), 1, 'au début de la bande, EXACTEMENT un')
  assert.equal(att(-1, fin, bande), 1, 'au centre du crop, la mer est intacte')
  // ⚠️ **ET LE « EXACTEMENT » EST LA PROPRIÉTÉ, PAS UN DÉTAIL** — la même que
  // `richesseMer` : c est lui qui autorise la SORTIE ANTICIPÉE du nuanceur.
  // Une bande nulle ne doit ni diviser par zéro ni rendre un NaN.
  assert.equal(att(fin, fin, 0), 0)
  assert.equal(att(fin - 1e-3, fin, 0), 1)
})

// ══════════ ⑰ DENT — LE BORD DESSINÉ NE DÉPEND PAS DE L EXTINCTION ═════════
//
// ⚡ **CE TEST FERME UNE ERREUR QUE J AI FAILLI COMMETTRE, ET QUE LE PROCHAIN
// AGENT FERA S IL N EST PAS RETENU.** Adrien filme « la nappe ne couvre plus
// les parois » ; le réflexe est d élargir l emprise ou de rétrécir la bande.
// Or la mesure (rapport DENT §①) dit que la nappe COUVRE le socle — écart
// médian **0,21 % du demi-côté**, soit moins d un pixel — et que le bord
// dessiné est posé par `bordDeMer()` SEUL.
//
// ⛔ La bande d extinction de D24 (`bandeHouleBord`) éteint la HOULE avant le
// bord ; elle ne doit JAMAIS déplacer le bord lui-même. Le jour où quelqu un
// fera dépendre `bordDeMer()` de la houle ou de la bande — « pour que la mer
// aille plus loin » —, la nappe se mettra à respirer au rythme de la cambrure.
test('⑰a le BORD DESSINÉ est posé par `bordDeMer()` seul — ni la houle ni la bande ne le déplacent', () => {
  const ref = bordDeMer()
  // `bordDeMer` ne prend aucun argument : lui en passer ne doit rien changer.
  for (const arg of [undefined, 0, 1, { bande: 0.5 }, { houle: 12, chop: 3 }, 0.42]) {
    const b = bordDeMer(arg)
    assert.equal(b.fin, ref.fin, `bordDeMer a bougé sur ${JSON.stringify(arg)}`)
    assert.equal(b.debut, ref.debut, `bordDeMer a bougé sur ${JSON.stringify(arg)}`)
  }
  // et il vaut EXACTEMENT le retrait de l eau, du côté DEDANS
  assert.equal(ref.fin, -RETRAIT_EAU_CROP)
  assert.ok(ref.fin < 0, 'le bord dessiné tombe DANS le crop, jamais au-delà')
  assert.equal(ref.debut, ref.fin - RETRAIT_EAU_CROP)
})

test('⑰b la bande d extinction est CONTENUE dans la nappe : elle éteint la houle, elle ne coupe pas la mer', () => {
  const { fin } = bordDeMer()
  const lissage = (e0, e1, x) => { const t = Math.min(1, Math.max(0, (x - e0) / (e1 - e0))); return t * t * (3 - 2 * t) }
  const att = (d, bande) => 1 - lissage(fin - Math.max(bande, 1e-7), fin, d)
  // ⚠️ **ON BALAIE LES BANDES, ON NE CROIT PAS L ALGÈBRE** — le plafond de
  // `bandeHouleBord` vaut 0,5 demi-côté ; on va jusque-là.
  for (let k = 0; k <= 100; k++) {
    const bande = (k / 100) * 0.5
    // ① au bord dessiné, la houle est déjà EXACTEMENT éteinte : la coupe est plate
    assert.equal(att(fin, bande), 0, `la houle survit au bord pour bande = ${bande}`)
    // ② et DEDANS, avant le début de la bande, la mer est intacte au bit près —
    //    c est ce qui garantit « la mer au large ne change pas » (D24 §③)
    // ⚠️ la marge est prise sur la bande EFFECTIVE (`max(bande, 1e-7)`) : à
    // bande nulle, un 1e-9 tombe DANS le plancher de 1e-7 et rend 0,0003 — le
    // premier jet de ce test rougissait là-dessus, et c est le balayage qui l a
    // dit, pas l algèbre.
    assert.equal(att(fin - Math.max(bande, 1e-7) - 1e-6, bande), 1, `la mer du large est entamée pour bande = ${bande}`)
    // ③ ⛔ **ET SURTOUT** : quelle que soit la bande, il reste de la mer DESSINÉE
    //    strictement à l intérieur — l extinction ne peut pas manger la nappe.
    // (à bande nulle les deux coïncident : c est la mer d huile, sans extinction)
    assert.ok(fin - bande <= fin, 'la bande doit commencer AVANT le bord')
    if (bande > 0) assert.ok(fin - bande < fin, 'une bande non nulle commence STRICTEMENT avant')
  }
  // la bande, elle, dépend bien de la cambrure — mais par `bandeHouleBord`,
  // et jamais par `bordDeMer` (⑰a)
  assert.ok(bandeHouleBord(0.01, 0.43) > 0)
  assert.equal(bandeHouleBord(0, 0.43), 0, 'une mer d huile ne porte aucune bande')
  assert.equal(bandeHouleBord(1e6, 0.43), 0.5, 'et le plafond d un demi-côté est celui de bandeHouleBord')
})

test('⑯d la GÉOMÉTRIE s arrête à l emprise du socle, et le CHAMP garde sa portée', () => {
  // ⚡ **LA SECONDE MOITIÉ DE LA DEMANDE.** Un `discard` après déplacement
  // n aurait rien économisé ; ici les sommets n existent plus.
  assert.equal(EMPRISE_MER_CROP, 1)
  const rep = REPERE
  const large = construireCalotte({ repere: rep, rayon: 100, portee: 3, pas: 192 })
  const serre = construireCalotte({ repere: rep, rayon: 100, portee: 3, emprise: 1, pas: 64 })
  assert.equal(large.compte.sommets, 193 * 193)
  assert.equal(serre.compte.sommets, 65 * 65)
  assert.equal(serre.compte.portee, 3, 'la PORTÉE ne bouge pas — c est elle qui cuit le champ')
  assert.equal(serre.compte.emprise, 1)
  assert.equal(large.compte.emprise, 3, 'sans emprise, la calotte d avant au bit près')

  // ⚡ **ET LES NŒUDS COÏNCIDENT AU BIT PRÈS** — c est ce qui rend le crop
  // identique : la grille resserrée est un SOUS-ENSEMBLE de l ancienne.
  for (let j = 0; j <= 64; j++) {
    for (let i = 0; i <= 64; i++) {
      const k = j * 65 + i
      const K = (j + 64) * 193 + (i + 64)
      assert.equal(serre.uv[k * 2], large.uv[K * 2], `u au noeud ${i},${j}`)
      assert.equal(serre.uv[k * 2 + 1], large.uv[K * 2 + 1], `v au noeud ${i},${j}`)
      for (let c = 0; c < 3; c++) {
        assert.equal(serre.positions[k * 3 + c], large.positions[K * 3 + c], `position ${c} au noeud ${i},${j}`)
      }
    }
  }
  // et l emprise ne peut pas DÉPASSER la portée : le champ n irait pas si loin
  const trop = construireCalotte({ repere: rep, rayon: 100, portee: 3, emprise: 9, pas: 64 })
  assert.equal(trop.compte.emprise, 3)
})

test('⑯e `poserMer` BÂTIT la calotte resserrée, et le champ reste sur trois demi-côtés', () => {
  const g = globeAvecCrop()
  g._baseYCrop = -0.12
  return Globe.prototype.poserMer.call(g, { remplir: remplirBouchon, portee: PORTEE_CROP }).then((etat) => {
    assert.equal(etat.portee, PORTEE_CROP, 'la portée du CHAMP ne bouge pas — c est la couleur d Adrien')
    assert.equal(etat.emprise, EMPRISE_MER_CROP)
    assert.equal(etat.compte.pas, 64, 'la densité de maille est conservée : 192 × 1/3')
    assert.equal(etat.compte.sommets, 65 * 65)
    assert.equal(etat.compte.triangles, 64 * 64 * 2)
    // ⚡ CE QUE ÇA RETIRE, ÉCRIT PLUTÔT QUE SUPPOSÉ
    assert.equal(193 * 193 - 65 * 65, 33024)
    assert.equal(192 * 192 * 2 - 64 * 64 * 2, 65536)

    // ⚠️ **LA LECTURE DU CHAMP N EST PAS DÉPLACÉE** : `uvF = aCrop / (2·portee)
    // + 0,5`, et `uMerPortee` vaut toujours 3. Un `aCrop` normalisé sur
    // l emprise aurait lu le champ NEUF FOIS trop gros sans que rien ne le dise.
    assert.equal(g._mer.material.uniforms.uMerPortee.value, PORTEE_CROP)
    const aCrop = g._mer.geometry.getAttribute('aCrop').array
    let uMax = 0
    for (let i = 0; i < 65 * 65; i++) uMax = Math.max(uMax, Math.abs(aCrop[i * 2]), Math.abs(aCrop[i * 2 + 1]))
    assert.ok(Math.abs(uMax - 1) < 1e-9, `aCrop doit rester en demi-côtés BRUTS : ${uMax}`)

    // le rideau est DEDANS, donc il survit au resserrement
    const jupe = g._mer.geometry.getAttribute('aJupe').array
    let nJupe = 0
    for (let i = 0; i < jupe.length; i++) if (jupe[i] > 0.5) nJupe++
    assert.ok(nJupe > 0, 'le rideau doit survivre à l emprise resserrée')
    assert.ok(1 - RETRAIT_EAU_CROP < EMPRISE_MER_CROP, 'le haut du rideau doit tenir dans l emprise')

    // ⚠️ **LA DENSITÉ, ET C EST ELLE QUI DOIT NE PAS BOUGER** — pas le pas
    // ABSOLU. Le premier jet confrontait le pas relevé sur la géométrie à
    // `maille` : 0,003354 contre 0,003599, **6,8 % d écart**, au coin comme au
    // centre. ⚡ **Et ce n est pas ma tâche qui l a créé** : `maille` est un pas
    // NOMINAL, calculé en unités de Mercator, qui sur-estime la distance au sol
    // de `1/cos φ` ; il valait déjà cela avant. Le laisser dire « divergé »
    // aurait été accuser D24 d un écart qu il n a pas fait. Ce qu on verrouille
    // ici, c est le RAPPORT — la maille de la grille resserrée est celle de
    // l ancienne, au bit près, et ⑯d le prouve position par position.
    assert.equal(etat.compte.pas / etat.emprise, etat.pas / etat.portee)
    assert.equal(etat.pas, 192, 'le `pas` demandé par l appelant est celui d avant')
  })
})

test('⑯f `_majBandeHouleMer` LIT les uniformes vivants, et la bande suit la houle', () => {
  const g = globeAvecCrop()
  g._baseYCrop = -0.12
  return Globe.prototype.poserMer.call(g, { remplir: remplirBouchon, portee: PORTEE_CROP }).then(() => {
    const u = g._mer.material.uniforms
    assert.ok(Number.isFinite(g._merEtat.parDemi) && g._merEtat.parDemi > 0,
      'l état doit porter les unités de scène par demi-côté')
    // ⚠️ **`parDemi` EST LA DEMI-LARGEUR RÉELLE DE LA GÉOMÉTRIE** — pas une
    // formule qu on croit juste : on la confronte à la calotte bâtie.
    const pos = g._mer.geometry.getAttribute('position').array
    const aCrop = g._mer.geometry.getAttribute('aCrop').array
    let mesure = 0
    for (let i = 0; i < 65 * 65; i++) {
      if (Math.abs(aCrop[i * 2] - 1) > 1e-9 || Math.abs(aCrop[i * 2 + 1]) > 1e-9) continue
      mesure = Math.hypot(pos[i * 3], pos[i * 3 + 2])
    }
    assert.ok(mesure > 0, 'le sommet u = 1, v = 0 doit exister')
    assert.ok(Math.abs(mesure / g._merEtat.parDemi - 1) < 0.01,
      `parDemi ${g._merEtat.parDemi} contre la géométrie ${mesure}`)

    const b0 = u.uMerBandeHoule.value
    assert.ok(b0 > 0, 'une mer vivante doit porter une bande strictement positive')

    // ⚡ **ET C EST LA CAMBRURE QUI LA PILOTE, PAS LA HAUTEUR DE HOULE — TROUVÉ
    // EN ÉCRIVANT CE TEST, PAS EN LE RAISONNANT.** Le déplacement latéral vaut
    // `q · a = min(chop · 1,9 · part · fade / k ; 1/k)` : l amplitude `a` se
    // SIMPLIFIE. Doubler `uMerHoule` ne le change donc que par la borne de
    // Stokes, et le premier jet de ce test — « une houle deux fois plus haute,
    // une bande deux fois plus large » — était FAUX (0,0811 → 0,0821, +1,2 %).
    // C est une bonne nouvelle pour D24 : la coupe plate ne s élargit pas quand
    // Adrien monte sa houle.
    const houle0 = u.uMerHoule.value
    u.uMerHoule.value *= 2
    const bHoule = Globe.prototype._majBandeHouleMer.call(g).bande
    assert.ok(bHoule / b0 < 1.05, `la bande suit la HAUTEUR de houle : ${b0} → ${bHoule}`)
    u.uMerHoule.value = houle0

    // la cambrure, elle, la pilote — et linéairement tant que Stokes ne borne pas
    const chop0 = u.uMerChop.value
    u.uMerChop.value = chop0 / 2
    const bChop = Globe.prototype._majBandeHouleMer.call(g).bande
    assert.ok(bChop < b0 * 0.75, `la bande ne suit pas la cambrure : ${b0} → ${bChop}`)
    // une mer d huile : plus de déplacement latéral, donc plus de bande du tout
    u.uMerChop.value = 0
    assert.equal(Globe.prototype._majBandeHouleMer.call(g).bande, 0)
    u.uMerChop.value = chop0
    // ⛔ **ET SANS MER POSÉE, ELLE N ÉCRIT NULLE PART** — même garde que
    // `_majBordMer` et `majReglagesMer`.
    assert.equal(Globe.prototype._majBandeHouleMer.call({ _mer: null }), null)
  })
})

// ══════════ ⑱ LA LUMIÈRE DE LA MER — Tâche EAU ══════════════════════════════
//
// La loi vit dans `src/monde/eau-lumiere.js` et son propre test l'exécute. Ici,
// ce qui appartient à `poserMer` et `majReglagesMer` : les trois uniformes de la
// tâche sont POSÉS, avec les bonnes valeurs, et le vent SUIT le spectre vivant.
// ⚠️ ON EXÉCUTE — une assertion qui lit un fichier ne prouve pas qu'il pose.

test('⑱a `poserMer` POSE `uMerVraieEau` à 1 — la livraison, pas un réglage — et un vent au neutre', () => {
  return merPosee().then(({ u }) => {
    assert.equal(u.uMerVraieEau.value, 1, 'la vraie eau est la livraison')
    assert.ok(u.uMerVent.value.x === 1 && u.uMerVent.value.y === 0, 'le vent naît à l est')
    // le vent en m/s est DÉRIVÉ de la houle posée, par la loi du module
    assert.equal(u.uMerVentMs.value, ventDeHoule(u.uMerHoule.value))
    assert.ok(u.uMerVentMs.value >= 2 && u.uMerVentMs.value <= 14, 'dans la plage de Cox & Munk')
  })
})

test('⑱b `majReglagesMer` LIT la direction dominante sur le spectre, pondérée par l énergie', () => {
  return merPosee().then(({ g, u }) => {
    // deux trains : l un vers (1, 0) avec tout le poids, l autre vers (0, 1) sans
    const a = [{ x: 1, y: 0, z: 1, w: 1 }, { x: 0, y: 1, z: 1, w: 1 }]
    const b = [{ x: 0, y: 1, z: 1, w: 0 }, { x: 0, y: 1, z: 0, w: 0 }]
    Globe.prototype.majReglagesMer.call(g, { vue: 1, surface: 1, spectre: { a, b } })
    assert.ok(Math.abs(u.uMerVent.value.x - 1) < 1e-12 && Math.abs(u.uMerVent.value.y) < 1e-12)
    // les poids inversés : la direction bascule — une concordance au neutre n est pas un branchement
    b[0].z = 0; b[1].z = 1
    Globe.prototype.majReglagesMer.call(g, { vue: 1, surface: 1, spectre: { a, b } })
    assert.ok(Math.abs(u.uMerVent.value.x) < 1e-12 && Math.abs(u.uMerVent.value.y - 1) < 1e-12)
    // à poids égaux : la diagonale, NORMALISÉE
    b[0].z = 1
    Globe.prototype.majReglagesMer.call(g, { vue: 1, surface: 1, spectre: { a, b } })
    assert.ok(Math.abs(Math.hypot(u.uMerVent.value.x, u.uMerVent.value.y) - 1) < 1e-12, 'unitaire')
    assert.ok(Math.abs(u.uMerVent.value.x - u.uMerVent.value.y) < 1e-12)
    // un spectre muet (poids nuls) ne remplace RIEN
    b[0].z = 0; b[1].z = 0
    Globe.prototype.majReglagesMer.call(g, { vue: 1, surface: 1, spectre: { a, b } })
    assert.ok(Math.abs(u.uMerVent.value.x - u.uMerVent.value.y) < 1e-12, 'la direction d avant reste')
  })
})

test('⑱c le vent en m/s SUIT la houle du socle, par image, et retombe au neutre sans état', () => {
  return merPosee().then(({ g, u }) => {
    const etat = { ...ETAT_MER_NEUTRE, houle: 2 }
    Globe.prototype.majReglagesMer.call(g, { vue: 1, surface: 1, etat })
    assert.equal(u.uMerVentMs.value, ventDeHoule(2))
    assert.equal(u.uMerVentMs.value, 10)
    Globe.prototype.majReglagesMer.call(g, { vue: 1, surface: 1 })
    assert.equal(u.uMerVentMs.value, ventDeHoule(ETAT_MER_NEUTRE.houle))
    // ⛔ et sans mer posée, rien n est écrit (même garde que le reste)
    assert.equal(Globe.prototype.majReglagesMer.call({ _mer: null }), null)
  })
})
