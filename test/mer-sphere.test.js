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
  FRACTION_BANDE_BORD,
  bordDeMer,
} from '../src/monde/mer-sphere.js'
import { zoomPourEmprise } from '../src/monde/flux-terrain.js'
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
import { repereLocalCrop, construireSolideCrop } from '../src/monde/parois-crop.js'
import { empriseSocle, FOV_DEG } from '../src/monde/seuil-socle.js'
import { largeurCropM, EXAG_SOCLE_NOMINALE, COTE_CROP_UNITES } from '../src/monde/habillage-crop.js'

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
  assert.match(src, /import \{ distanceRivage \} from '\.\/monde\/mer-sphere\.js'/)
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
  assert.match(bloc[0], /if\s*\(\s*richesseMer\s*<=\s*0\.0\s*\)/)
})


test('⑧c la rampe nautique du FOND, dans le nuanceur du globe, transcrit le MÊME exposant', () => {
  // ⚠️ Tour de correction 1 (constat I2) : `pow(…, 0.55)` de la transcription
  // dans `globe.js` (la ligne qui peint le fond marin sous `uMerRampeOn`)
  // n'était protégée par AUCUN test — seule `abscisseNautique`, la loi PURE
  // du module, l'était (⑨d). Une mutation qui change cet exposant en `1.0`
  // survivait à 44/44. Même patron que ⑧a : on extrait le texte, on le
  // confronte À LA FONCTION PURE sur un balayage.
  const expr = extraitGlsl('dMer01')
  const js = expr
    .replace(/pow\(/g, 'POW(')
    .replace(/clamp\(/g, 'CLAMP(')
    .replace(/max\(/g, 'MAX(')
    .replace(/uMerFondBudgetM/g, 'budget')
    .replace(/uPlancherRampeM/g, 'plancher')
  // eslint-disable-next-line no-new-func
  const f = new Function('h', 'budget', 'plancher', 'POW', 'CLAMP', 'MAX', `return ${js}`)
  const CLAMP = (x, a, b) => Math.min(b, Math.max(a, x))
  let vus = 0
  for (let prof = 0; prof <= 1000; prof += 5) {
    const attendu = abscisseNautique(prof, 1000)
    const rendu = f(-prof, 1000, 1e-6, Math.pow, CLAMP, Math.max)
    assert.ok(Math.abs(rendu - attendu) < 1e-9, `profondeur ${prof} : ${rendu} contre ${attendu}`)
    vus++
  }
  assert.ok(vus > 150, `le balayage doit être dense : ${vus} points`)
  // un exposant de 1,0 rendrait 0,1 à 10 % de profondeur — c'est la mutation
  // que ce test tue, comme ⑨d le fait déjà pour la loi pure.
  assert.ok(Math.abs(f(-100, 1000, 1e-6, Math.pow, CLAMP, Math.max) - Math.pow(0.1, 0.55)) < 1e-9)
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
  const m = bloc[0].match(/float fade = smoothstep\(([^,]+), ([^,]+), vRive\) \* richesseMer;/)
  assert.ok(m, 'le fondu de rivage est absent ou d une autre forme')
  assert.equal(m[1].trim(), '0.0')
  assert.equal(m[2].trim(), '0.10')
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
  assert.match(bloc[0], /pow\(clamp\(-h \/ max\(uMerFondBudgetM/)
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
      uOceanShallow: val({ set() {} }),
      uOceanMid: val({ set() {} }),
      uOceanDeep: val({ set() {} }),
      // Tâche J : le bord de la mer les lit — VRAIS uniformes, pas des bouchons,
      // pour que `poserEstompage` et `_majBordMer` s'exercent l'un sur l'autre.
      uEstompageOn: val(0),
      uEstompage: val(1),
    },
    _echelleContinue: creerEchelleContinue(RAMPE_MONDE),
    retirerMer: Globe.prototype.retirerMer,
    _cuireChampMer: Globe.prototype._cuireChampMer,
    _majBordMer: Globe.prototype._majBordMer,
    _melangeCalottes() {},
    _calottes: [],
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
  // estompage = 1 : il ne reste que le crop. Le fondu doit finir SUR la
  // frontière, à la largeur du chanfrein près — c'est là que `plinth.js`
  // arrête l'eau du mode plat (`rayonEauDansSocle`).
  const b = bordDeMer(1)
  assert.equal(b.debut, 0, 'le fondu commence exactement à la frontière du crop')
  assert.ok(Math.abs(b.fin - RETRAIT_EAU_CROP) < 1e-12, `fin ${b.fin}`)
  // ⚠️ **ET LE TÉMOIN QUI COMPTE** : la mer d'avant la Tâche J allait à
  // l'horizon géométrique, soit ~93 demi-côtés à l'altitude de naissance du
  // socle. Trois ordres de grandeur.
  assert.ok(b.fin < porteeHorizon(REPERE, 32274, R_TERRE_M) / 1000)
})

test('⑪c la mer VA JUSQU AU BORD DE LA CALOTTE quand la planète est entière', () => {
  const b = bordDeMer(0)
  assert.ok(Math.abs(b.fin - (PORTEE_CROP - 1)) < 1e-12, `fin ${b.fin} contre ${PORTEE_CROP - 1}`)
  // la bande de fondu couvre la fraction annoncée de l'anneau extérieur
  assert.ok(Math.abs(b.debut - (PORTEE_CROP - 1) * (1 - FRACTION_BANDE_BORD)) < 1e-12)
})

test('⑪d le bord est MONOTONE en estompage — c est ce qui interdit un à-coup', () => {
  // ⚠️ **UNE MUTATION DE SIGNE SURVIT À DEUX BORNES SEULES.** On balaie.
  let precedent = Infinity
  for (let i = 0; i <= 40; i++) {
    const b = bordDeMer(i / 40)
    assert.ok(b.fin <= precedent + 1e-12, `la mer ne doit jamais S ÉTENDRE en descendant (${i})`)
    assert.ok(b.debut >= 0 && b.debut <= b.fin, `bornes incohérentes à ${i} : ${b.debut} / ${b.fin}`)
    precedent = b.fin
  }
  // et le SENS n'est pas interchangeable : effacer la Terre RÉTRÉCIT la mer
  assert.ok(bordDeMer(1).fin < bordDeMer(0).fin)
})

test('⑪e une valeur non finie ne peut pas faire disparaître la mer', () => {
  // même contrat que `poserEstompage` : un NaN dans un uniforme éteint la
  // moitié d'un GPU sans un mot. Ici il retombe sur « la planète est entière ».
  for (const mauvais of [NaN, undefined, null, 'x', {}]) {
    assert.deepEqual(bordDeMer(mauvais), bordDeMer(0), `${String(mauvais)}`)
  }
  // et l'écrêtage tient des deux côtés
  assert.deepEqual(bordDeMer(-5), bordDeMer(0))
  assert.deepEqual(bordDeMer(12), bordDeMer(1))
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
  // la mesure est celle de la découpe : cq / pn / uCropCoinN, comme le nuanceur
  // des tuiles — pas un max(abs(u), abs(v))
  assert.ok(/pow\(pow\(cq\.x, uCropCoinN\) \+ pow\(cq\.y, uCropCoinN\), 1\.0 \/ uCropCoinN\)/.test(frag),
    'la superellipse de la découpe doit être celle du bord')
  const sorties = frag.match(/gl_FragColor = vec4\([^;]*;/g) || []
  assert.equal(sorties.length, 2, 'le fragment a exactement deux sorties')
  for (const s of sorties) assert.ok(/\bbord \*/.test(s), `sortie sans bord : ${s}`)
  // et le rejet anticipé : au-delà du bord, rien n'est calculé
  assert.ok(/if \(bord <= 0\.0\) discard;/.test(frag))
})

test('⑪h `poserMer` POSE le bord, et `poserEstompage` le RECALE', () => {
  const g = globeAvecCrop()
  return Globe.prototype.poserMer.call(g, { remplir: remplirBouchon, portee: PORTEE_CROP }).then(() => {
    const u = g._mer.material.uniforms.uMerBord.value
    // sans estompage posé, la planète est ENTIÈRE : la mer va au bord
    assert.ok(Math.abs(u.y - (PORTEE_CROP - 1)) < 1e-9, `fin ${u.y}`)
    Globe.prototype.poserEstompage.call(g, 1)
    assert.ok(Math.abs(u.y - RETRAIT_EAU_CROP) < 1e-9, `après estompage plein : ${u.y}`)
    assert.equal(u.x, 0)
    // et le retour : `retirerEstompage` rend la planète entière, donc la mer
    Globe.prototype.retirerEstompage.call(g)
    assert.ok(Math.abs(u.y - (PORTEE_CROP - 1)) < 1e-9, `après retrait : ${u.y}`)
  })
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
