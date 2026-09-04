// LA RAMPE DU CROP — Tâche D du plan « UNE SEULE TERRE »
// (`docs/superpowers/plans/2026-08-21-terre-unique.md`).
//
// ══════════ CE QUE CE FICHIER VÉRIFIE, ET CE QU'IL NE PEUT PAS ══════════════
//
// Même partage que `crop-sphere`, `crop-parois` et `crop-habillage` :
//   ① LA LOI vit dans un module PUR (`src/monde/rampe-crop.js`), sans three ni
//      DOM, et se vérifie sous node, point par point ;
//   ② LE NUANCEUR est vérifié en EXTRAYANT son expression de rampe et en
//      l'ÉVALUANT — pas en cherchant un nom dedans.
//
// ⚠️ **LA DIFFÉRENCE AVEC LES TROIS TÂCHES PRÉCÉDENTES EST LÀ, ET ELLE EST
// DÉLIBÉRÉE.** Le piège que ce chantier a payé huit fois, c'est l'assertion qui
// « teste la présence d'un nom ». Une assertion `/uLandBas/` serait verte dès
// qu'on écrit le mot, même dans un commentaire, même si l'expression ne
// l'emploie pas. Ce fichier extrait donc `float t = sousEau ? … ;` du texte du
// nuanceur, le traduit mécaniquement en JS (`clamp` → `CLAMP`, `max` → `Math.max`)
// et **l'exécute** sur un balayage de hauteurs. Une divergence d'un bit tue.
//
// ⚠️ **CE QUI RESTE HORS DE PORTÉE** : que le GPU exécute ce texte, et que
// l'image obtenue soit celle du socle. Seul l'écran le dit — Étape 6 de la
// tâche, et son compte rendu.
//
// ══════════ LES ASSERTIONS ONT ÉTÉ REJOUÉES AVANT D'ÊTRE ÉCRITES ═══════════
//
// Le banc est `.banc/rejoue-D.mjs`, **LAISSÉ SUR LE DISQUE**. Il rejoue chaque
// candidate contre CINQ lois — le dépôt (`82e8b87`, rampe mondiale fixe), une
// rampe locale « naïve » (sans plancher, sans séparation mer/terre), une rampe
// locale **bridée au crop** (le monde garderait 5 600 : la couture au bord que la
// décision 4 interdit), une rampe mesurée sur la **BOÎTE** du crop au lieu de sa
// forme, et la cible. **Neuf candidates sur neuf distinguent au moins une loi**,
// et chaque test ci-dessous dit LAQUELLE il tue.
//
// ⚠️ **UNE SEULE EST VERTE CONTRE LE DÉPÔT, ET ELLE EST DÉCLARÉE COMME TELLE** :
// ①c (« les alentours suivent »). Elle est verte contre le dépôt parce que la
// rampe mondiale est, elle aussi, sans couture — c'est ①d qui porte la preuve.
// On la garde parce qu'elle est **ROUGE contre la loi bridée**, qui est le
// contresens le plus probable de la décision 4.

import test from 'node:test'
import assert from 'node:assert/strict'
import { readFileSync } from 'node:fs'

import {
  PLANCHER_AMPLITUDE_UNITES,
  PAS_MESURE,
  RAMPE_MONDE,
  GRADE_MONDE,
  HYPSO_MONDE_M,
  histogrammeDesQuantiles,
  plancherRampeDuCrop,
  plancherAmplitudeM,
  mesurerRelief,
  echelleRampe,
  rampeT,
  saturation,
  CRAN_RECOLLAGE_BAS,
  CRAN_RECOLLAGE_HAUT,
  poidsRecollage,
  rampeTMonde,
} from '../src/monde/rampe-crop.js'
// ⚠️ **IMPORTÉ PAR LE TEST, PAS PAR LA SOURCE — et c'est R1.** `seuil-socle.js`
// décide du CADRAGE ; ⑥b interdit à `rampe-crop.js` de l'importer. Le lien entre
// les deux crans du recollage et les seuils de vie du crop est donc VÉRIFIÉ ici
// (⑧b), là où une dépendance ne crée aucune boucle.
import { SEUIL_BLOC_M, SEUIL_BLOC_MORT_M } from '../src/monde/seuil-socle.js'
import { plancherPivot, rampeT as rampeTSocleTest } from '../src/monde/naturel-crop.js'
import { unitesEnMetres, margeCoteM, MARGE_COTE_UNITES } from '../src/monde/habillage-crop.js'
import { repereCrop, latLonDeLocal, localCrop, dansCrop } from '../src/monde/crop-sphere.js'
import { Globe } from '../src/globe.js'
import { creerEchelleContinue } from '../src/monde/echelle-continue.js'
import { gradeForDem, quantileFromHistogram } from '../src/relief-grade.js'
import { NATUREL_MONDE } from '../src/monde/naturel-crop.js'

const SRC_GLOBE = new URL('../src/globe.js', import.meta.url)
const SRC_TERRAIN = new URL('../src/terrain.js', import.meta.url)
const globeSrc = readFileSync(SRC_GLOBE, 'utf8')

// ══════════ L'OUTILLAGE — EXTRAIRE ET EXÉCUTER L'EXPRESSION DU NUANCEUR ════
//
// ⚠️ **`.banc/extrait-D.mjs` EN PORTE UNE COPIE, ET C'EST VOULU** : le banc de
// rejeu doit pouvoir évaluer la rampe d'une révision ANCIENNE (`git show`), ce
// qu'un test n'a pas à faire. Les deux copies sont confrontées par ②e, qui exige
// que la traduction rende, sur le dépôt d'aujourd'hui aux valeurs par défaut,
// exactement la rampe historique.

function expressionRampe(src) {
  const i = src.indexOf('float t = sousEau')
  assert.ok(i >= 0, 'le nuanceur doit porter « float t = sousEau »')
  const j = src.indexOf(';', i)
  return src
    .slice(i + 'float t = '.length, j)
    .replace(/\/\/[^\n]*/g, ' ')
    .replace(/\s+/g, ' ')
    .trim()
}

// ⚠️ **`hNorm` EST DÉSORMAIS UNE LIGNE À PART — Tâche P2, ET LE TEST LA SUIT.**
// La branche TERRE de `float t` s'écrivait en toutes lettres ; la colorisation
// naturelle a besoin de la MÊME amplitude locale quatre fois de plus (pivot,
// limite des arbres, voile aérien), et l'écrire deux fois aurait donné deux
// amplitudes à garder d'accord. La loi n'a pas bougé d'un bit — c'est pourquoi
// on l'EXTRAIT ELLE AUSSI et qu'on l'exécute, au lieu de la supposer.
function expressionHNorm(src) {
  const i = src.indexOf('float hNorm = clamp(')
  assert.ok(i >= 0, 'le nuanceur doit porter « float hNorm = clamp( »')
  const j = src.indexOf(';', i)
  return src
    .slice(i + 'float hNorm = '.length, j)
    .replace(/\/\/[^\n]*/g, ' ')
    .replace(/\s+/g, ' ')
    .trim()
}

function CLAMP(x, a, b) {
  return Math.min(Math.max(x, a), b)
}

const enJs = (glsl) =>
  glsl
    .replace(/\bclamp\s*\(/g, 'CLAMP(')
    .replace(/\bmax\s*\(/g, 'Math.max(')
    .replace(/\bmin\s*\(/g, 'Math.min(')

/** Le TEXTE du nuanceur, rendu exécutable. */
function loiDuNuanceur(src) {
  const hn = enJs(expressionHNorm(src))
  const js = enJs(expressionRampe(src))
  const noms = [...new Set(`${hn} ${js}`.match(/\bu[A-Z][A-Za-z0-9]*/g) || [])]
  // eslint-disable-next-line no-new-func
  const f = new Function(
    'h',
    'sousEau',
    'u',
    'CLAMP',
    `const {${noms.join(',')}} = u; const hNorm = (${hn}); return (${js});`
  )
  return { js, hNorm: hn, noms, t: (h, sousEau, u) => f(h, sousEau, u, CLAMP) }
}

/** Les uniformes de rampe que `poserRampe` posera, pour une échelle donnée. */
function uniformesDe(e) {
  return {
    uLandBas: e.terreBas,
    uLandMax: e.terreHaut,
    uOceanDepth: e.profondeur,
    uPlancherRampeM: e.plancherM,
  }
}

// Les trois emprises de référence du banc de rejeu, reprises telles quelles.
const MAURICE = { minM: -140, maxM: 828, minTerreM: 0, maxTerreM: 828 }
const ALPIN = { minM: 402, maxM: 4808, minTerreM: 402, maxTerreM: 4808 }
const PLAT = { minM: 12, maxM: 12, minTerreM: 12, maxTerreM: 12 }
const PLANCHER = 0.0066 // m — voir ⑤a, il est CONVERTI et non choisi

const eMaurice = echelleRampe(MAURICE, { plancherM: PLANCHER })
const eAlpin = echelleRampe(ALPIN, { plancherM: PLANCHER })
const ePlat = echelleRampe(PLAT, { plancherM: PLANCHER })

// ══════════ ① LA LOI — CE QUE LA DÉCISION 4 EXIGE ══════════════════════════

test('①a la rampe atteint son SOMMET sur un crop à faible relief', () => {
  // ⚠️ TUE LE DÉPÔT (t = 0,4429 à 828 m — les 14,3 % dont Adrien s'est plaint)
  // et TUE la loi « boîte ». C'est le grief des captures, transposé en nombre.
  assert.equal(rampeT(828, eMaurice, false), 1)
  assert.ok(rampeT(827, eMaurice, false) < 1)
})

test("①b le BAS de la rampe TERRE est le plancher de terre du crop", () => {
  // ⚠️ TUE LE DÉPÔT **et** la loi « naïve » : c'est l'ancre BASSE, celle que
  // « s'étale sur l'amplitude locale » impose et qu'un `h / max` seul n'a pas.
  assert.equal(rampeT(402, eAlpin, false), 0.35)
  assert.ok(rampeT(500, eAlpin, false) > 0.35)
  // et le sommet touche le haut : l'amplitude entière est utilisée
  assert.equal(rampeT(4808, eAlpin, false), 1)
})

test('①c les ALENTOURS suivent — même hauteur, même couleur, dedans ou dehors', () => {
  // ⚠️ **GARDE-FOU DÉCLARÉ : VERTE CONTRE LE DÉPÔT.** La rampe mondiale est sans
  // couture elle aussi. Elle est en revanche ROUGE contre la loi BRIDÉE, qui
  // n'applique l'échelle locale qu'au crop — le contresens le plus probable de
  // la décision 4, et celui qui fabrique la couture au bord.
  //
  // La preuve tient à la SIGNATURE : `rampeT` ne reçoit ni position, ni verdict
  // d'appartenance au crop. Elle ne PEUT pas répondre deux choses.
  assert.equal(rampeT.length, 3)
  for (const h of [-3000, -1, 0, 1, 250, 828, 4000]) {
    assert.equal(rampeT(h, eMaurice, h < 0), rampeT(h, eMaurice, h < 0))
  }
})

test('①d ... et cette valeur commune est LOCALE, pas mondiale', () => {
  // ⚠️ C'est ①d qui tue le dépôt, pas ①c. Écart mesuré à 500 m : la rampe
  // mondiale rend 0,4080, la rampe de Maurice 0,7426.
  const monde = loiDuNuanceur(globeSrc).t(500, false, {
    uLandBas: 0, uLandMax: 5600, uOceanDepth: 6000, uPlancherRampeM: 0,
  })
  const locale = rampeT(500, eMaurice, false)
  assert.ok(Math.abs(locale - monde) > 0.3, `écart trop faible : ${locale} contre ${monde}`)
})

test('①e la MER suit le crop : son point le plus bas est le fond de la rampe', () => {
  // ⚠️ TUE LE DÉPÔT : à -140 m, la rampe mondiale rend 0,3418 — un bleu de
  // plateau continental — quand le crop en fait son abysse.
  assert.equal(rampeT(-140, eMaurice, true), 0)
  assert.ok(rampeT(-139, eMaurice, true) > 0)
})

test('①f le niveau de la mer reste à t = 0,35 — le partage NE bouge pas', () => {
  // ⚠️ **GARDE-FOU DÉCLARÉ : VERT CONTRE LE DÉPÔT**, ROUGE contre la loi
  // « naïve » à rampe unique. C'est lui qui garantit qu'un littoral reste un
  // littoral d'un crop à l'autre.
  assert.equal(rampeT(0, eMaurice, false), 0.35)
  assert.equal(rampeT(0, eAlpin, false), 0.35)
  assert.equal(rampeT(0, ePlat, false), 0.35)
  assert.equal(rampeT(-0, eMaurice, true), 0.35)
})

test('①g un crop RIGOUREUSEMENT PLAT ne rend jamais NaN', () => {
  // ⚠️ TUE la loi « naïve » : `(h - min) / (max - min)` avec max == min rend
  // NaN, et le §« écrêtage de Mercator » de globe.js dit où mène un NaN dans ce
  // nuanceur — une comparaison fausse, donc un fragment GARDÉ.
  for (const h of [-9000, -1, 0, 11.999, 12, 12.001, 1000, 9000]) {
    for (const se of [false, true]) {
      const t = rampeT(h, ePlat, se)
      assert.ok(Number.isFinite(t), `t(${h}, sousEau=${se}) = ${t}`)
      assert.ok(t >= 0 && t <= 1, `t hors [0,1] : ${t}`)
    }
  }
  assert.ok(ePlat.terreHaut > ePlat.terreBas)
  assert.ok(ePlat.profondeur > 0)
})

test("①h l'ancre basse est le minimum de la TERRE, pas du relief", () => {
  // ⚠️ Sur Maurice, `minM` vaut -140 : le prendre pour ancre basse mettrait le
  // niveau de la mer à 0,44 et ferait quitter au littoral le bas de la rampe.
  assert.equal(eMaurice.terreBas, 0)
  assert.equal(eMaurice.profondeur, 140)
  // et sur un crop intérieur, l'ancre basse est bien la vallée
  assert.equal(eAlpin.terreBas, 402)
  // ⚠️ ... dont la profondeur retombe alors sur le PLANCHER, et c'est la
  // conséquence acceptée : un crop sans mer aplatit toute la mer du monde.
  assert.equal(eAlpin.profondeur, PLANCHER)
})

test("①i le CREUX dit de combien le relief descend SOUS SA TERRE — Tâche P11", () => {
  // ⛔ **CE QUE `profondeur` NE SAIT PAS DIRE, ET LA NOTATION 03 LE PAIE.**
  // `profondeur` est un BUDGET DE PROFONDEUR : sur un crop sans mer elle retombe
  // au PLANCHER DE DIVISION, c'est-à-dire sur un aveu (« je ne sais pas à quelle
  // profondeur descend la mer »), et `echelle-continue` a raison de refuser de
  // l'ancrer. Mais `hNormRelief` s'en servait comme ANCRE BASSE DU RELIEF, où
  // « je ne sais pas » n'a aucun sens : le relief, lui, a toujours un minimum.
  //
  // `creux` est ce minimum, exprimé POSITIVEMENT et RELATIVEMENT à `terreBas` —
  // deux propriétés obligatoires : positif parce que la courbe d'ancrage mélange
  // en `log1p` (`echelle-continue.js` §6, `log1p(max(0, v))` écraserait un
  // négatif), relatif parce que `terreBas - creux` doit rendre `minM` AU BIT PRÈS
  // quelle que soit l'interpolation des deux champs.
  assert.equal(eMaurice.creux, 140)      // terreBas 0, minM -140
  assert.equal(eAlpin.creux, 0)          // ⚡ AUCUNE MER : le creux est NUL, et c'est un FAIT
  assert.equal(ePlat.creux, 0)
  // ⚡ ET C'EST L'IDENTITÉ QUI COMPTE : `terreBas - creux` EST `minM`.
  for (const [m, e] of [[MAURICE, eMaurice], [ALPIN, eAlpin], [PLAT, ePlat]]) {
    assert.ok(Object.is(e.terreBas - e.creux, m.minM), `${e.terreBas} - ${e.creux} != ${m.minM}`)
  }
  // ⛔ ET LE CREUX N'EST PAS `profondeur` : sur un crop sans mer, l'un vaut ZÉRO
  // et l'autre le PLANCHER, et l'ancre basse qu'ils désignent diffère de 402 m.
  assert.notEqual(eAlpin.creux, eAlpin.profondeur)
  assert.equal(eAlpin.terreBas - eAlpin.creux, 402)
  assert.ok(Math.abs(-eAlpin.profondeur - 402) > 400)
})

test("①i bis le creux ne peut JAMAIS être négatif — et l’algèbre dit pourquoi", () => {
  // ⚠️ **UNE SURVIVANTE A DEMANDÉ CE TEST.** La mutation qui retire le `max(0, …)`
  // survivait, et la première réaction — « donc c'est du code mort » — n'est
  // vraie que d'un côté, et il faut dire lequel.
  //
  // ⚡ **CÔTÉ `mesurerRelief`, LA BRANCHE EST INATTEIGNABLE PAR L'ALGÈBRE** :
  // `minTerreM` est le minimum sur le sous-ensemble `h >= 0`, `minM` le minimum
  // sur TOUS les points, donc `minM <= minTerreM = terreBas`. On le REJOUE au
  // lieu de le supposer, sur un relief qui plonge et un relief qui ne plonge pas.
  for (const zone of [(u, v) => u < 0, (u, v) => false]) {
    const m = mesurerRelief({
      repere: REPERE, forme: FORME, pas: 24,
      hauteur: (lat, lon) => { const q = localCrop(lat, lon, REPERE); return zone(q.u, q.v) ? -700 : 300 },
    })
    assert.ok(m.minM <= m.minTerreM, `${m.minM} > ${m.minTerreM}`)
    assert.ok(echelleRampe(m, { plancherM: PLANCHER }).creux >= 0)
  }
  // ⛔ **MAIS `echelleRampe` EST EXPORTÉE, ET SON ENTRÉE N'EST PAS TOUJOURS UNE
  // MESURE DU DÉPÔT** — ce fichier lui en passe trois écrites à la main, et
  // `poserRampe({ echelle })` est le point d'entrée des bancs. La garde n'est
  // donc PAS morte : elle défend un appelant qui existe, et voici ce qu'elle
  // empêche — un creux négatif, que `log1p(max(0, v))` écraserait à zéro sans
  // un mot, et qui remonterait l'ancre basse AU-DESSUS de la terre.
  const incoherente = { minM: 900, maxM: 2000, minTerreM: 100, maxTerreM: 2000 }
  const e = echelleRampe(incoherente, { plancherM: PLANCHER })
  assert.equal(e.creux, 0, 'une mesure incohérente doit rendre un creux NUL, pas négatif')
  assert.ok(e.terreBas - e.creux <= e.terreHaut, "l'ancre basse ne peut pas dépasser le sommet")
})

test("①j `echelleRampe` rend TOUJOURS un creux fini — il n'y a pas de repli à écrire", () => {
  // ⚠️ **C'EST CE QUI AUTORISE `_poserUniformesRampe` À LE LIRE SANS GARDE.** Un
  // `undefined` y poserait un `NaN` dans un uniforme, c'est-à-dire une
  // comparaison FAUSSE dans le nuanceur (§ « écrêtage de Mercator » de
  // `globe.js`). On exige donc la totalité, on n'écrit pas un repli qui la
  // supposerait absente.
  for (const m of [MAURICE, ALPIN, PLAT,
    { minM: -6000, maxM: 0, minTerreM: 0, maxTerreM: 0 },   // tout en mer
    { minM: 0, maxM: 0, minTerreM: 0, maxTerreM: 0 }]) {
    const e = echelleRampe(m, { plancherM: PLANCHER })
    assert.ok(Number.isFinite(e.creux) && e.creux >= 0, JSON.stringify(e))
  }
  assert.ok(Number.isFinite(RAMPE_MONDE.creux))
  // ⚡ **ET LE DÉFAUT MONDIAL REND L'ANCRE D'AVANT LA TÂCHE P11, AU BIT PRÈS** :
  // `terreBas - creux` vaut `-profondeur`, donc `hNormRelief` retombe sur
  // `(h + uOceanDepth) / (uLandMax + uOceanDepth)`. La production est intouchée.
  assert.ok(Object.is(RAMPE_MONDE.terreBas - RAMPE_MONDE.creux, -RAMPE_MONDE.profondeur))
})

// ══════════ ② LE NUANCEUR — LA TRANSCRIPTION, EXÉCUTÉE ═════════════════════

test("②a l'expression du nuanceur porte les QUATRE uniformes de la rampe", () => {
  // ⚠️ **CE N'EST PAS UN TEST DE PRÉSENCE DE NOM** : `noms` est extrait de
  // l'EXPRESSION `float t = …`, pas du fichier. Un `uLandBas` écrit dans un
  // commentaire, ou déclaré et jamais employé, ne passe pas ici.
  const { noms } = loiDuNuanceur(globeSrc)
  assert.deepEqual(
    [...noms].sort(),
    ['uLandBas', 'uLandMax', 'uOceanDepth', 'uPlancherRampeM'],
  )
})

test('②b le nuanceur et la loi JS rendent le MÊME t, sur tout le balayage', () => {
  // ⚠️ « Deux écritures jumelles finiraient par diverger » — terrain.js. Ici
  // elles sont confrontées, à trois échelles et sur 2 000 hauteurs.
  const loi = loiDuNuanceur(globeSrc)
  // ⚠️ **`eDegenere` N'EST PAS UN CAS D'ÉCOLE, C'EST CE QUI REND LA GARDE DE
  // DIVISION ATTEIGNABLE.** La campagne de mutation l'a montré : retirer le
  // `max(…, uPlancherRampeM)` du nuanceur SURVIVAIT, parce que `echelleRampe`
  // applique déjà le plancher et que le `max` valait donc toujours son premier
  // terme — une constante inatteignable, §2 de /threejs-optimisation.
  // `poserRampe({ echelle })` accepte une échelle POSÉE À LA MAIN : celle-ci en
  // est une, et sans la garde elle rend 0/0.
  const eDegenere = { terreBas: 1200, terreHaut: 1200, profondeur: 0, plancherM: 2000 }
  for (const e of [eMaurice, eAlpin, ePlat, eDegenere]) {
    const u = uniformesDe(e)
    // ⚠️ **LES ANCRES SONT DANS LE BALAYAGE, ET C'EST LA CAMPAGNE DE MUTATION
    // QUI L'A IMPOSÉ** : au pas régulier de 18 m, `h = terreBas` était SAUTÉ (i
    // vaut 566,67), et la mutation qui retire la garde de division survivait —
    // c'est là, et là seulement, que 0/0 se produit.
    const ancres = [e.terreBas, e.terreHaut, -e.profondeur, 0, e.terreBas + 1e-6]
    for (let i = 0; i <= 1000 + ancres.length; i++) {
      const h = i <= 1000 ? -9000 + (i * 18000) / 1000 : ancres[i - 1001]
      for (const se of [false, true]) {
        assert.equal(loi.t(h, se, u), rampeT(h, e, se), `h=${h} sousEau=${se}`)
      }
    }
  }
})

test("②c la rampe est calculée UNE SEULE FOIS, hors de toute branche", () => {
  // ⚠️ **C'EST L'ASSERTION QUI TUE LA LOI BRIDÉE.** Pour appliquer une échelle
  // au crop et une autre au monde, il faudrait un SECOND calcul de `t` sous une
  // garde par fragment : les uniformes, eux, sont posés par appel de dessin et
  // ne savent rien de l'appartenance au crop. Une seule occurrence de
  // « float t = » et une seule lecture de la rampe : la couture ne peut pas
  // naître.
  const frag = globeSrc.slice(globeSrc.indexOf('const FRAG'))
  assert.equal((frag.match(/\bfloat t = /g) || []).length, 1)
  assert.equal((frag.match(/texture2D\(uRamp,/g) || []).length, 1)
  // ⚠️ **LA TABLE DU SOCLE EST UNE SECONDE LECTURE, ET ELLE NE ROUVRE PAS LA
  // COUTURE — Tâche P2.** `uRampCrop` EST le LUT 2D du bloc, lu une seule fois,
  // sous une garde qui est un UNIFORME (`uRampCropOn`) : les uniformes sont
  // posés par appel de dessin et valent la même chose pour TOUTES les tuiles de
  // la planète. La loi bridée que ce test tue demanderait au contraire une garde
  // par FRAGMENT — l'appartenance au crop —, et c'est exactement ce que
  // l'assertion suivante interdit dans les deux expressions de rampe.
  assert.equal((frag.match(/texture2D\(uRampCrop,/g) || []).length, 1)
  // ... et NI L'UNE NI L'AUTRE ne consulte le crop ou la couverture
  const expr = expressionRampe(globeSrc)
  assert.ok(!/uCrop|couvertureCrop|qCrop|dedans/.test(expr), expr)
  assert.ok(!/uCrop|couvertureCrop|qCrop|dedans/.test(expressionHNorm(globeSrc)), expressionHNorm(globeSrc))
  const iRampT = frag.indexOf('float rampT = natRampT(')
  assert.ok(iRampT > 0, 'le nuanceur doit dériver rampT de natRampT (module partagé)')
  const exprRampT = frag.slice(iRampT, frag.indexOf(';', iRampT))
  assert.ok(!/couvertureCrop|qCrop|dedans/.test(exprRampT), exprRampT)
})

/**
 * Le bloc `this.uniforms = { ... }` de `globe.js`, borné sur la FERMETURE de
 * l'objet.
 *
 * ⚠️ **LA PREMIÈRE VERSION LE BORNAIT SUR `_materialFor`, ET C'ÉTAIT FAUX** :
 * le nom est CITÉ dans le commentaire du bloc lui-même (« que `_materialFor`
 * étale dans chaque matériau »), donc la tranche s'arrêtait AVANT `uLandBas` et
 * l'assertion échouait pour la mauvaise raison.
 */
function blocUniformes() {
  const i = globeSrc.indexOf('this.uniforms = {')
  assert.ok(i > 0)
  const j = globeSrc.indexOf('\n    }\n', i)
  assert.ok(j > i)
  return globeSrc.slice(i, j)
}

/** uniforme du nuanceur -> champ de `RAMPE_MONDE`. */
const CHAMPS = [
  ['uLandBas', 'terreBas'],
  ['uLandMax', 'terreHaut'],
  ['uOceanDepth', 'profondeur'],
  ['uPlancherRampeM', 'plancherM'],
]

// ⚠️ **`uReliefBas` EST LE CINQUIÈME, ET IL EST DÉRIVÉ, PAS RECOPIÉ — Tâche
// P11.** Il ne correspond à aucun champ de `RAMPE_MONDE` pris seul : il vaut
// `terreBas − creux`. Il est donc vérifié à part, ci-dessous, avec la même
// exigence — lu depuis `RAMPE_MONDE`, jamais écrit en dur.
const EXPR_RELIEF_BAS = 'RAMPE_MONDE.terreBas - RAMPE_MONDE.creux'

test('②d ter TOUT uniforme LU par le fragment y est DÉCLARÉ — le nuanceur compile', () => {
  // ⛔ **UNE SURVIVANTE A DEMANDÉ CE TEST, ET IL EST GÉNÉRIQUE.** Retirer la
  // ligne `uniform float uReliefBas;` du nuanceur ne faisait rougir personne :
  // aucun test ne LISAIT le texte du fragment pour y chercher ses déclarations,
  // et le défaut ne se serait vu qu'au chargement de la page — « un agent a
  // livré du code qui plantait au démarrage AVEC 3 098 tests verts » (§0 du
  // plan). L'assertion vaut pour TOUS les uniformes, pas seulement le mien.
  const i = globeSrc.indexOf('const FRAG =')
  const frag = globeSrc.slice(i, globeSrc.indexOf('\nconst ', i + 10))
  const declares = new Set([...frag.matchAll(/^uniform\s+\w+\s+(u[A-Za-z0-9]+)\s*;/gm)].map((m) => m[1]))
  // le corps SEUL — on retire les lignes de déclaration et les commentaires
  const corps = frag
    .split('\n')
    .filter((l) => !/^uniform\s/.test(l.trim()) && !/^\s*\/\//.test(l))
    .join('\n')
  const lus = new Set([...corps.matchAll(/\bu[A-Z][A-Za-z0-9]*/g)].map((m) => m[0]))
  const orphelins = [...lus].filter((n) => !declares.has(n))
  assert.deepEqual(orphelins, [], 'uniformes lus mais jamais déclarés : ' + orphelins.join(', '))
  // ⚠️ **ET LE TÉMOIN : LE TEST DOIT VOIR QUELQUE CHOSE.** Sans lui, un jour où
  // l'extraction rendrait une chaîne vide, ce test serait vert pour rien.
  assert.ok(declares.size > 40, 'seulement ' + declares.size + ' uniformes déclarés')
  assert.ok(lus.has('uReliefBas') && declares.has('uReliefBas'))
})

test('②d bis `uReliefBas` naît de `RAMPE_MONDE` et `retirerRampe` l’y ramène — Tâche P11', () => {
  assert.ok(blocUniformes().includes(`uReliefBas: { value: ${EXPR_RELIEF_BAS} }`),
    'uReliefBas ne dérive pas de RAMPE_MONDE dans this.uniforms')
  const retirer = globeSrc.slice(globeSrc.indexOf('  retirerRampe() {'))
  assert.ok(retirer.slice(0, 900).includes(`u.uReliefBas.value = ${EXPR_RELIEF_BAS}`),
    'retirerRampe ne rend pas uReliefBas')
  // ⚡ ET LA VALEUR NEUTRE EST CELLE D'AVANT LA TÂCHE P11, AU BIT PRÈS.
  assert.ok(Object.is(RAMPE_MONDE.terreBas - RAMPE_MONDE.creux, -RAMPE_MONDE.profondeur))
  // ⚠️ **ET IL EST POSÉ PAR L'ÉCRIVAIN UNIQUE**, `_poserUniformesRampe`, pas
  // ailleurs : deux écritures d'un uniforme de rampe, c'est le défaut que ce
  // module documente déjà (« il y en avait DEUX, plus un troisième »).
  const ecritures = globeSrc.split('uReliefBas.value =').length - 1
  assert.equal(ecritures, 2, 'uReliefBas doit s’écrire exactement dans _poserUniformesRampe et retirerRampe')
  const poseur = globeSrc.slice(globeSrc.indexOf('  _poserUniformesRampe(e, altitudeM = null) {'))
  assert.ok(poseur.slice(0, 1400).includes('u.uReliefBas.value = e.terreBas - e.creux'),
    '_poserUniformesRampe ne pose pas l’ancre basse du relief')
})

test('②d les quatre uniformes sont PARTAGÉS — donc les alentours les portent', () => {
  // ⚠️ C'est la mécanique exacte de « les alentours la suivent » : les quatre
  // vivent dans `this.uniforms`, que `_materialFor` étale dans CHAQUE matériau
  // de tuile. Une tuile de l'autre côté de la planète peint avec l'échelle du
  // crop, et c'est le but — il n'y a qu'UNE rampe, donc pas de couture.
  //
  // ⚠️ **ET ILS LISENT `RAMPE_MONDE`, ILS NE RECOPIENT PAS SES NOMBRES.**
  // `5600` et `6000` étaient des littéraux ici ; `retirerRampe` en aurait fait
  // une seconde copie, et une constante dupliquée diverge en silence (§1 de
  // /threejs-optimisation, question 2).
  const bloc = blocUniformes()
  for (const [n, champ] of CHAMPS) {
    assert.ok(
      bloc.includes(`${n}: { value: RAMPE_MONDE.${champ} }`),
      `${n} ne lit pas RAMPE_MONDE.${champ} dans this.uniforms`,
    )
  }
  // et `retirerRampe` les repose tous les quatre, depuis la MÊME source
  const retirer = globeSrc.slice(globeSrc.indexOf('  retirerRampe() {'))
  for (const [n, champ] of CHAMPS) {
    assert.ok(retirer.slice(0, 700).includes(`u.${n}.value = RAMPE_MONDE.${champ}`), n)
  }
})

test("②e SANS `poserRampe`, LE GLOBE EST CELUI D'AVANT — au bit près", () => {
  // ⚠️ **LA MÊME GARDE QUE `uCropOn` ET `uHabOn`, ET LA MÊME PREUVE.** Les
  // valeurs par défaut du dépôt sont rejouées dans l'expression d'AUJOURD'HUI et
  // confrontées à la rampe HISTORIQUE, réécrite ici mot pour mot depuis
  // `git show 82e8b87:src/globe.js`. Un `Object.is` : pas d'epsilon, pas de
  // tolérance — le bit.
  const loi = loiDuNuanceur(globeSrc)
  // ⚠️ Les valeurs par défaut sont celles de `RAMPE_MONDE`, et ②d vient de
  // vérifier que `this.uniforms` les LIT au lieu de les recopier.
  assert.deepEqual({ ...RAMPE_MONDE }, { terreBas: 0, terreHaut: 5600, profondeur: 6000, creux: 6000, plancherM: 0 })
  const defauts = uniformesDe(RAMPE_MONDE)
  const historique = (h, se) =>
    se ? 0.35 * (1 - CLAMP(-h / 6000, 0, 1)) : 0.35 + 0.65 * CLAMP(h / 5600, 0, 1)
  for (let i = 0; i <= 2000; i++) {
    const h = -12000 + (i * 24000) / 2000
    for (const se of [false, true]) {
      assert.ok(
        Object.is(loi.t(h, se, defauts), historique(h, se)),
        `h=${h} sousEau=${se} : ${loi.t(h, se, defauts)} vs ${historique(h, se)}`,
      )
    }
  }
})

test('②f `poserRampe` et `retirerRampe` existent, et `retirerCrop` retire la rampe', () => {
  assert.match(globeSrc, /\n {2}poserRampe\(/)
  assert.match(globeSrc, /\n {2}retirerRampe\(\)/)
  const retirer = globeSrc.slice(globeSrc.indexOf('  retirerCrop()'))
  assert.match(retirer.slice(0, 400), /this\.retirerRampe\(\)/)
})

// ══════════ ② bis `poserRampe` EXERCÉE, PAS SEULEMENT NOMMÉE ═════════
//
// ⚠️ **LA TÂCHE B A PAYÉ EXACTEMENT CE DÉFAUT** : « `hauteurSurface` n'était
// testée que par un `grep` de son nom », et le `.call` sur un objet minimal a
// trouvé un repli d'antiméridien faux. Même patron ici, et il a servi : sans
// ②h, le refus de couverture n'aurait été qu'une intention de commentaire.
//
// ⚠️ Monter un `Globe` entier réclamerait le DOM (rampe de couleurs, calottes,
// atmosphère, coquille de nuages) : on appelle la méthode sur l'objet minimal
// qu'elle lit réellement — `uniforms`, `_crop`, `tuilesAvecHauteurs`.

function faussGlobe(crop, hauteur) {
  const val = (v) => ({ value: v })
  return {
    _crop: crop,
    uniforms: {
      uLandBas: val(RAMPE_MONDE.terreBas),
      uLandMax: val(RAMPE_MONDE.terreHaut),
      uOceanDepth: val(RAMPE_MONDE.profondeur),
      uReliefBas: val(RAMPE_MONDE.terreBas - RAMPE_MONDE.creux),
      uPlancherRampeM: val(RAMPE_MONDE.plancherM),
      uCropCoin: val(FORME.coin),
      uCropCoinN: val(FORME.expo),
      // ⚠️ **AJOUTÉS PAR LA TÂCHE K bis, ET CE SONT DES MÉTHODES QU'IL EXERCE.**
      // Ce faux globe porte exactement ce que `poserRampe` lit et écrit ; la
      // tâche lui a donné un uniforme de plus (le zéro de la mer), un poseur
      // d'uniformes unique et le partage de l'échelle continue. Les emprunter
      // au VRAI prototype plutôt que les bricoler est ce qui rend ce banc utile
      // — un bouchon de `_poserUniformesRampe` laisserait passer une pose qui
      // n'écrit rien.
      uMerZeroSousEau: val(0),
      uMerRampeOn: val(0),
      uMerFondBudgetM: val(RAMPE_MONDE.profondeur),
      // ⚠️ **AJOUTÉ PAR LA TÂCHE R31**, et c'est la même raison qu'au-dessus :
      // `_poserUniformesRampe` l'ÉCRIT désormais, donc un faux globe qui ne le
      // porte pas fait lever la méthode empruntée au vrai prototype. La table
      // factice suit l'écrivain, elle ne le contourne pas.
      uRecollage: val(0),
    },
    _echelleContinue: creerEchelleContinue(RAMPE_MONDE),
    _poserUniformesRampe: Globe.prototype._poserUniformesRampe,
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

test('②g `poserRampe` MESURE le crop et pose les quatre uniformes', () => {
  // un relief de synthèse : une pente de 0 à 800 m sur la largeur du crop, et
  // un lagon à − 60 m sur la moitié ouest.
  const g = faussGlobe(REPERE, (lat, lon) => {
    const { u } = localCrop(lat, lon, REPERE)
    return u < -0.5 ? -60 : (800 * (u + 0.5)) / 1.5
  })
  const r = poser(g, { pas: 64 })
  assert.equal(r.refus, null)
  assert.equal(r.mesure.couverture, 1)
  const u = lire(g)
  assert.ok(u.uLandMax > 700 && u.uLandMax <= 800, `uLandMax = ${u.uLandMax}`)
  assert.ok(u.uOceanDepth > 0 && u.uOceanDepth <= 60, `uOceanDepth = ${u.uOceanDepth}`)
  // ⚠️ ET IL A CHANGÉ : sans cette ligne, le test passerait sur une méthode qui
  // ne fait rien, l'échelle mondiale étant déjà « posée ».
  assert.notEqual(u.uLandMax, RAMPE_MONDE.terreHaut)
  assert.notEqual(u.uOceanDepth, RAMPE_MONDE.profondeur)
  assert.ok(u.uPlancherRampeM > 0)
})

test('②h un TROU dans le relief REFUSE la pose — la rampe en place ne bouge pas', () => {
  // ⚠️ **LE §7 DE `parois-crop.js`, APPLIQUÉ À LA RAMPE.** Le refus doit être
  // sans effet de bord : les couleurs précédentes restent à l'écran jusqu'à ce
  // que la donnée arrive, et l'appelant n'a rien à défaire.
  const g = faussGlobe(REPERE, (lat, lon) => {
    const { v } = localCrop(lat, lon, REPERE)
    return v > 0 ? null : 400
  })
  // on pose d'abord une échelle connue, pour voir si le refus l'écrase
  poser(g, { echelle: { terreBas: 11, terreHaut: 2200, profondeur: 33, plancherM: 0.01 } })
  const avant = lire(g)
  const r = poser(g, { pas: 32 })
  assert.equal(r.refus, 'couverture')
  assert.equal(r.echelle, null)
  assert.deepEqual(lire(g), avant)
})

test('②i SANS crop posé, `poserRampe` refuse et ne touche à rien', () => {
  const g = faussGlobe(null, () => 400)
  const avant = lire(g)
  const r = poser(g, { pas: 16 })
  assert.equal(r.refus, 'crop')
  assert.deepEqual(lire(g), avant)
})

test('②j `retirerRampe` rend EXACTEMENT `RAMPE_MONDE`', () => {
  const g = faussGlobe(REPERE, () => 400)
  poser(g, { echelle: { terreBas: 11, terreHaut: 2200, profondeur: 33, plancherM: 0.01 } })
  assert.notDeepEqual(lire(g), uniformesDe(RAMPE_MONDE))
  Globe.prototype.retirerRampe.call(g)
  assert.deepEqual(lire(g), uniformesDe(RAMPE_MONDE))
  assert.equal(g._rampe, null)
})

// ══════════ ③ LA MESURE — SUR LA FORME, ET SOUS RÉSERVE DE COUVERTURE ══════

const REPERE = repereCrop({ centre: { lat: -20.9, lon: 55.5 } }) // La Réunion
const FORME = { coin: 2.24 / 28, expo: 4.4 } // les réglages par défaut du socle
const LAT_CENTRE = latLonDeLocal(0, 0, REPERE).lat

const PAS_COIN = 400

/** Le pic de synthèse : 9 000 m sur une zone décrite en coordonnées LOCALES. */
function relief(zone) {
  return (lat, lon) => {
    const { u, v } = localCrop(lat, lon, REPERE)
    return zone(u, v) ? 9000 : 100
  }
}

/** Combien de centres de cellule tombent dans `zone`, et combien y sont DEHORS ? */
function comptePoints(zone, pas = PAS_COIN) {
  let dedans = 0
  let dehors = 0
  for (let j = 0; j < pas; j++) {
    const v = -1 + (2 * j + 1) / pas
    for (let i = 0; i < pas; i++) {
      const u = -1 + (2 * i + 1) / pas
      if (!zone(u, v)) continue
      const { lat, lon } = latLonDeLocal(u, v, REPERE)
      if (dansCrop(lat, lon, REPERE, FORME)) dedans++
      else dehors++
    }
  }
  return { dedans, dehors }
}

const COIN = (u, v) => Math.abs(u) >= 0.995 && Math.abs(v) >= 0.995
const BORD_EST = (u, v) => u >= 0.99 && Math.abs(v) <= 0.01

test('③a la mesure exclut les COINS : un pic hors superellipse ne compte pas', () => {
  // ⚠️ **TUE LA LOI « BOÎTE ».** Un pic de 9 000 m dans le carré |u|,|v| ≥ 0,995 :
  // il est DANS la boîte du crop et HORS de sa superellipse.
  //
  // ⚠️ **ET LA MARGE EST MINCE, IL FAUT LE DIRE** : au coin par défaut du socle
  // (rayon 2,24 sur un demi-côté de 28, soit 0,08 ; exposant 4,4), le point
  // (1 ; 1) n'est dehors que de 0,0137 unité locale — 1,4 %. C'est pourquoi le
  // balayage est ici à 400 et non à 64 : à 64, aucun centre de cellule ne tombe
  // dans la lunule, et le test passerait **à vide**.
  const c = comptePoints(COIN)
  assert.equal(c.dedans, 0, 'la zone de test déborde dans le crop')
  assert.ok(c.dehors >= 4, `le balayage ne touche pas la lunule : ${c.dehors} point(s)`)

  const m = mesurerRelief({ repere: REPERE, forme: FORME, pas: PAS_COIN, hauteur: relief(COIN) })
  assert.equal(m.refus, null)
  assert.equal(m.maxM, 100)
  assert.equal(m.minM, 100)
})

test("③b ... et elle voit un pic qui est DANS la forme (le témoin de ③a)", () => {
  // ⚠️ Sans ce témoin, ③a passerait aussi sur une mesure qui ne voit RIEN —
  // « un test de silhouette passe à vide », §3 de /threejs-optimisation. Ici le
  // pic est au MILIEU du côté est, là où la superellipse est exacte.
  const c = comptePoints(BORD_EST)
  assert.equal(c.dehors, 0)
  assert.ok(c.dedans >= 4)
  const m = mesurerRelief({ repere: REPERE, forme: FORME, pas: PAS_COIN, hauteur: relief(BORD_EST) })
  assert.equal(m.maxM, 9000)
})

test('③c une tuile manquante REFUSE la mesure — elle ne vaut pas zéro', () => {
  // ⚠️ **LE §7 DE `parois-crop.js`, APPLIQUÉ À LA RAMPE.** Un `null` pris pour
  // zéro creusait une encoche dans la paroi ; ici il écraserait `minTerreM` à
  // zéro et repeindrait tout le crop dès qu'une seule tuile manque.
  const m = mesurerRelief({
    repere: REPERE,
    forme: FORME,
    pas: 32,
    hauteur: (lat) => (lat > LAT_CENTRE ? null : 400),
  })
  assert.equal(m.refus, 'couverture')
  assert.ok(m.couverture > 0 && m.couverture < 1)
  assert.ok(m.manquants > 0)
  // le refus ne fabrique pas d'échelle : les extrema rendus sont neutres
  assert.equal(m.minTerreM, 0)
})

test('③d ... et un appelant qui ABAISSE le seuil achète le mensonge', () => {
  // le comportement est documenté, donc il est testé : sous `couvertureMin`
  // abaissé, la mesure passe et ne compte QUE les points vus.
  const m = mesurerRelief({
    repere: REPERE,
    forme: FORME,
    pas: 32,
    couvertureMin: 0.1,
    hauteur: (lat) => (lat > LAT_CENTRE ? null : 400),
  })
  assert.equal(m.refus, null)
  assert.equal(m.minM, 400)
  assert.equal(m.maxM, 400)
})

test('③e le balayage prend les CENTRES de cellule, et il est SYMÉTRIQUE', () => {
  // ⚠️ **LA PREMIÈRE VERSION DE CE TEST PRÊTAIT AUX CENTRES UNE VERTU QU'ILS
  // N'ONT PAS, ET LA CAMPAGNE DE MUTATION L'A ATTRAPÉE.** Elle affirmait qu'aux
  // nœuds « la couverture tomberait sous 1 par construction » : c'est FAUX. Un
  // point hors forme est écarté par `continue` AVANT d'être compté manquant — il
  // ne dégrade donc rien. La mutation « revenir aux nœuds » a SURVÉCU, et c'est
  // écrit dans le compte rendu de la tâche plutôt que maquillé.
  //
  // Ce que les centres donnent vraiment, et qui est ici vérifié SUR LES POINTS
  // RÉELLEMENT VISITÉS (relevés dans le rappel `hauteur`) : aucun échantillon ne
  // tombe EXACTEMENT sur la frontière, où le verdict de `dansDalle` se joue à
  // l'arrondi et où `hauteurSurface` chevauche deux tuiles ; et le jeu de points
  // est symétrique en u comme en v, donc la mesure ne dépend pas du sens de
  // parcours.
  const vus = []
  const m = mesurerRelief({
    repere: REPERE,
    forme: FORME,
    pas: 16,
    hauteur: (lat, lon) => {
      vus.push(localCrop(lat, lon, REPERE))
      return 7
    },
  })
  assert.equal(m.couverture, 1)
  assert.equal(m.refus, null)
  assert.ok(vus.length > 0)
  const us = vus.map((q) => q.u)
  const vs = vus.map((q) => q.v)
  for (const x of us.concat(vs)) assert.ok(Math.abs(x) < 1, `un échantillon touche la frontière : ${x}`)
  assert.ok(Math.abs(Math.min(...us) + Math.max(...us)) < 1e-12)
  assert.ok(Math.abs(Math.min(...vs) + Math.max(...vs)) < 1e-12)
})

test('③e bis le `pas` de l appelant est HONORÉ, pas ignoré', () => {
  // ⚠️ Sans cette assertion, un `pas` figé en dur passerait toute la suite : la
  // campagne l'a vérifié (mutation M11 bis). Or le compte rendu de la tâche
  // JUSTIFIE `PAS_MESURE` par une mesure de convergence — un `pas` ignoré
  // rendrait cette justification sans objet.
  const compte = (pas) => {
    let n = 0
    mesurerRelief({ repere: REPERE, forme: FORME, pas, hauteur: () => { n++; return 7 } })
    return n
  }
  assert.ok(compte(32) > 3 * compte(16), `${compte(32)} contre ${compte(16)}`)
  assert.ok(compte(8) < compte(16))
})

test('③f un crop ENTIÈREMENT EN MER rend une échelle finie', () => {
  const m = mesurerRelief({ repere: REPERE, forme: FORME, pas: 16, hauteur: () => -3500 })
  assert.equal(m.refus, null)
  assert.equal(m.maxTerreM, 0)
  const e = echelleRampe(m, { plancherM: PLANCHER })
  assert.equal(e.profondeur, 3500)
  assert.ok(e.terreHaut > e.terreBas)
  assert.ok(Number.isFinite(rampeT(1200, e, false)))
})

test('③g PAS_MESURE est un entier ≥ 2 et le pas est arrondi, jamais tronqué', () => {
  assert.ok(Number.isInteger(PAS_MESURE) && PAS_MESURE >= 2)
  const a = mesurerRelief({ repere: REPERE, forme: FORME, pas: 0, hauteur: () => 3 })
  assert.equal(a.refus, null) // pas < 2 est relevé à 2, pas de boucle vide
  assert.ok(a.vus > 0)
})

// ══════════ ④ LA SATURATION — LA CONSÉQUENCE, MESURÉE ══════════════════════

test('④a une plaine lointaine à 3 000 m SATURE contre un crop de Maurice', () => {
  // ⚠️ TUE LE DÉPÔT (0,6982 à 3 000 m — du relief, pas du blanc). C'est la
  // conséquence qu'Adrien a acceptée en connaissance de cause, et elle est
  // TESTÉE, pas seulement écrite.
  assert.equal(rampeT(3000, eMaurice, false), 1)
  const s = saturation([0, 400, 828, 1500, 3000, 8848], eMaurice)
  assert.equal(s.haut, 4) // 828 (qui touche pile), 1 500, 3 000, 8 848
  assert.equal(s.bas, 1) // 0 m, l'ancre basse
  assert.equal(s.total, 6)
  // seul 400 m échappe à la saturation : cinq hauteurs sur six s'écrasent
  assert.ok(Math.abs(s.fraction - 5 / 6) < 1e-12)
})

test('④b contre un crop ALPIN, ce sont les PLAINES qui saturent par le bas', () => {
  // ⚠️ C'est le cas nommé dans la décision 4 : « une plaine à côté d'un crop
  // alpin sera monochrome ». `terreBas` vaut 402 m, donc tout le plat du monde
  // s'écrase sur la première teinte de terre.
  const s = saturation([0, 50, 200, 402, 1200, 4808, 6000], eAlpin)
  assert.equal(s.bas, 4) // 0, 50, 200, 402
  assert.equal(s.haut, 2) // 4808, 6000
  assert.ok(s.fraction > 0.8)
})

test('④c la saturation compte AUSSI la mer, et sur un crop sans mer elle est totale', () => {
  // ⚠️ Sur `eAlpin`, `profondeur` retombe au plancher (6,6 mm) : toute la mer du
  // monde s'écrase sur l'abysse. C'est le point le plus visible de l'Étape 4.
  const s = saturation([-10, -1000, -6000], eAlpin)
  assert.equal(s.mer, 3)
  assert.equal(s.fraction, 1)
  const s2 = saturation([-10, -1000, -6000], eMaurice)
  assert.equal(s2.mer, 2) // -1000 et -6000 dépassent les 140 m du crop
})

test('④d `saturation` ignore les trous, elle ne les compte pas comme saturés', () => {
  const s = saturation([100, NaN, null, 828], eMaurice)
  assert.equal(s.total, 2)
})

// ══════════ ⑤ LE PLANCHER — CONVERTI, ET SA SOURCE EST TENUE ═══════════════

test("⑤a le plancher d'amplitude est le 1e-4 de terrain.js, et il y est encore", () => {
  // ⚠️ **UNE CONSTANTE RECOPIÉE FINIT PAR DIVERGER** (§1 de
  // /threejs-optimisation). La parade est la même que celle de `EXAG_SOCLE_NOMINALE`
  // : ce test LIT `terrain.js` et échoue si la source change.
  const terrain = readFileSync(SRC_TERRAIN, 'utf8')
  assert.match(terrain, /max\(uHeightRange\.y - uHeightRange\.x, 1e-4\)/)
  assert.equal(PLANCHER_AMPLITUDE_UNITES, 1e-4)
})

test('⑤b il est CONVERTI en mètres, pas recopié', () => {
  // 185,3 m/unité (crop z13 de 10 377 m sur 56 unités), exagération 2,8
  const m = plancherAmplitudeM(185.3, 2.8)
  assert.ok(Math.abs(m - 0.006618) < 1e-5, `${m}`)
  // recopier « 1e-4 » aurait donné un dixième de millimètre : 66 fois moins
  assert.ok(m / 1e-4 > 60)
})

test('⑤c `unitesEnMetres` ne change PAS `margeCoteM` — au bit près', () => {
  // ⚠️ **RÈGLE DES LISTES DU §0 : on élargit, on ne remplace pas.** La Tâche D a
  // sorti la conversion de `margeCoteM` ; ce test exige que l'ancienne rende
  // exactement ce que rendait la formule inline.
  for (const mpu of [1, 42.5, 185.3, 1e6]) {
    for (const k of [1, 2.8, 18]) {
      assert.ok(Object.is(margeCoteM(mpu, k), (MARGE_COTE_UNITES * mpu) / k))
      assert.ok(Object.is(unitesEnMetres(MARGE_COTE_UNITES, mpu, k), margeCoteM(mpu, k)))
    }
  }
  assert.throws(() => unitesEnMetres(1, 1, 0), TypeError)
  assert.throws(() => unitesEnMetres(NaN, 1, 1), TypeError)
})

// ══════════ ⑥ R1 — LA BOUCLE EST COUPÉE, ET C'EST VÉRIFIÉ ══════════════════

test('⑥a aucune décision de CADRAGE ne lit l’échelle de la rampe', () => {
  // ⚠️ **R1 A DÉJÀ MORDU TROIS FOIS SUR CE CHANTIER** — dont un pilote
  // d'exagération de gain mesuré 1,44, donc divergent, et un autre qui gelait.
  // La rampe a le droit de LIRE le relief ; ce qui est interdit, c'est qu'une
  // décision de cadrage relise la rampe. Ce test tient la porte fermée.
  for (const f of ['seuil-socle.js', 'descente-bornee.js', 'exageration-continue.js', 'veille-socle.js', 'flux-terrain.js']) {
    const src = readFileSync(new URL(`../src/monde/${f}`, import.meta.url), 'utf8')
    assert.ok(
      !/uLandBas|uLandMax|uOceanDepth|uReliefBas|uPlancherRampeM|rampe-crop/.test(src),
      `${f} lit l'échelle de la rampe — R1 est rompue`,
    )
  }
})

test('⑥b `rampe-crop.js` n’importe rien qui décide d’un cadrage', () => {
  const src = readFileSync(new URL('../src/monde/rampe-crop.js', import.meta.url), 'utf8')
    const imports = [...src.matchAll(/\bfrom '([^']+)'/g)].map((m) => m[1])
  // ⚠️ **ON ÉLARGIT, ON NE REMPLACE PAS** (règle des listes du §0). `relief-grade.js`
  // est entré avec la Tâche R11 (`GRADE_MONDE`), et il est admissible pour une
  // raison VÉRIFIÉE juste en dessous, pas par confiance : il n'importe RIEN, et
  // il ne rend que des réglages d'APPARENCE (`mapTint`, `heightContrast`,
  // `heightPivot`, `slopeTint`). Aucune décision de cadrage ne peut en sortir.
  // ⚠️ **ET `naturel-crop.js` EST ENTRÉ AVEC LA TÂCHE R28**, pour `plancherPivot`
  // et `rampeT` — la loi de rampe DU SOCLE, importée au lieu d'être recopiée une
  // seconde fois ici. Il est admissible pour la MÊME raison que `relief-grade.js`,
  // et elle est vérifiée juste en dessous, pas prise de confiance : il n'importe
  // RIEN, et il ne rend que des lois d'APPARENCE.
  assert.deepEqual(imports.sort(), ['../relief-grade.js', './crop-sphere.js', './habillage-crop.js', './naturel-crop.js'])
  const grade = readFileSync(new URL('../src/relief-grade.js', import.meta.url), 'utf8')
  // ⛔ **LE `\b` ÉTAIT UN RETOUR ARRIÈRE (0x08), ET L'ASSERTION ÉTAIT TOUJOURS
  // VRAIE — trouvé par R28.** `/\x08from …/` ne peut RIEN trouver dans une source
  // ; `matchAll` rendait donc systématiquement une liste vide et le `assert.equal
  // (…, 0)` passait quoi qu'il arrive. C'est la QUATRIÈME occurrence de cet
  // incident sur ce chantier (deux dans `plan-fusion.md`, une cette nuit), et la
  // première qui dormait dans un test COMMITÉ. **Relire l'octet écrit
  // (`grep | cat -A`) est la seule parade : un `\b` dans une chaîne non brute est
  // un retour arrière dans tous les langages de ce dépôt.**
  // ⚠️ Vérifiée en la cassant : avec le `\b` rendu, ajouter une importation à
  // `relief-grade.js` fait rougir la ligne ; avant, non.
  assert.equal([...grade.matchAll(/\bfrom '([^']+)'/g)].length, 0, 'relief-grade.js doit rester une feuille')
  // ⚠️ **LES MÊMES NOMS QUE ⑥a, ET PAS DES MOTS DE PROSE.** Une première version
  // cherchait « altitude » et « distance » : `relief-grade.js` en parle dans ses
  // commentaires (« contraste d'altitude », « les altitudes émergées ») et le test
  // échouait sur du français. Ce qui compte est ce qu'il LIT.
  assert.ok(
    !/uLandBas|uLandMax|uOceanDepth|uReliefBas|uPlancherRampeM|rampe-crop|seuil-socle|descente-bornee|camera|controls/.test(grade),
    'relief-grade.js touche à une grandeur de cadrage — R1 est rompue',
  )
  // ⚠️ **LA MÊME VÉRIFICATION POUR `naturel-crop.js`, ET AU MÊME PRIX** : une
  // feuille, et aucune grandeur de cadrage. C'est ce qui rend son entrée dans la
  // liste ci-dessus admissible plutôt que tolérée.
  const naturel = readFileSync(new URL('../src/monde/naturel-crop.js', import.meta.url), 'utf8')
  assert.equal([...naturel.matchAll(/\bfrom '([^']+)'/g)].length, 0, 'naturel-crop.js doit rester une feuille')
  // ⚠️ **ET ON RETIRE LES COMMENTAIRES AVANT DE CHERCHER — la mise en garde de
  // ⑥a, payée une seconde fois.** `naturel-crop.js` CITE `uLandBas`, `uLandMax`
  // et `uPlancherRampeM` dans son en-tête, en toutes lettres, pour dire dans
  // quelle unité chaque grandeur normalisée arrive. La première rédaction de
  // cette ligne rougissait donc sur de la PROSE. Ce qui compte est ce que le
  // CODE lit.
  const naturelCode = naturel.replace(/\/\*[\s\S]*?\*\//g, '').replace(/^\s*\/\/.*$/gm, '')
  assert.ok(
    !/uLandBas|uLandMax|uOceanDepth|uReliefBas|uPlancherRampeM|rampe-crop|seuil-socle|descente-bornee|controls/.test(naturelCode),
    'naturel-crop.js touche à une grandeur de cadrage — R1 est rompue',
  )
  // ⚠️ **ET LA GARDE SE PROUVE** : sans le retrait des commentaires, la même
  // recherche trouve bien ces noms — donc le retrait n'est pas décoratif.
  assert.ok(/uLandBas/.test(naturel), 'l’en-tête cite bien uLandBas : la garde ci-dessus a un objet')
})


// ══════════ ⑦ LE GRADE DU MONDE — Tâche R11 ════════════

test('⑦a l’histogramme à trois pics rend EXACTEMENT les trois quantiles', () => {
  // ⚠️ **CE N'EST PAS UNE APPROXIMATION, ET C'EST CE QUI AUTORISE À NE PAS
  // RECOPIER LA RÈGLE DE CADRAGE.** `gradeForDem` ne lit que `q = 0,08`, `0,5`
  // et `0,92` ; si l'histogramme les rend au pas de quantification près, le
  // grade rendu est celui des quantiles MESURÉS.
  const minM = RAMPE_MONDE.terreBas - RAMPE_MONDE.creux
  const maxM = RAMPE_MONDE.terreHaut
  const h = histogrammeDesQuantiles(HYPSO_MONDE_M, minM, maxM)
  const pas = (maxM - minM) / h.length
  for (const [q, cible] of [[0.08, HYPSO_MONDE_M.p08], [0.5, HYPSO_MONDE_M.p50], [0.92, HYPSO_MONDE_M.p92]]) {
    const lu = quantileFromHistogram(h, minM, maxM, q, 0)
    assert.ok(Math.abs(lu - cible) <= pas, `q=${q} : ${lu} au lieu de ${cible} (pas ${pas})`)
  }
  // trois pics, et rien d'autre : une masse ailleurs déplacerait les quantiles
  assert.equal([...h].filter((v) => v > 0).length, 3)
})

test('⑦b GRADE_MONDE est celui de `gradeForDem`, dans l’échelle du NUANCEUR', () => {
  // ⛔ **L'ÉCHELLE EST LE PIÈGE, ET IL EST SILENCIEUX.** Le nuanceur indexe
  // `natRampT` sur `hNormRelief`, normalisé sur `[terreBas − creux ; terreHaut]`
  // — le FOND MARIN COMPRIS. Un grade calculé sur les seules terres rendrait
  // `pivot ≈ 0,085` et peindrait la planète avec le haut de la rampe.
  const minM = RAMPE_MONDE.terreBas - RAMPE_MONDE.creux
  const maxM = RAMPE_MONDE.terreHaut
  const attendu = gradeForDem({ minM, maxM, histogram: histogrammeDesQuantiles(HYPSO_MONDE_M, minM, maxM) })
  assert.equal(GRADE_MONDE.heightContrast, attendu.heightContrast)
  assert.equal(GRADE_MONDE.heightPivot, attendu.heightPivot)
  // le pivot vit au-dessus du plancher de `natPlancherPivot` dans cette échelle,
  // sinon le plancher prendrait la main et le grade mesuré ne servirait à rien
  const hNormMer = (0 - minM) / (maxM - minM)
  assert.ok(GRADE_MONDE.heightPivot > Math.min(Math.max(hNormMer, 0), 0.95) + 0.02)
})

const globeNu = () => Object.assign(Object.create(Globe.prototype), {
  // ⚠️ **UN GLOBE DE PAPIER, PAS UN VRAI — le patron de `crop-habillage.test.js`**
  // (`Globe.prototype.X.call` sur un objet minimal). Le constructeur réel appelle
  // `rebuildRamp`, qui touche le DOM : sous node il lèverait avant la première
  // assertion, et ce test-ci ne parle QUE des quatre uniformes de la loi.
  _crop: null,
  _rampeMonde: null,
  uniforms: {
    uRampCrop: { value: null },
    uRampCropOn: { value: 0 },
    uHeightContrast: { value: NATUREL_MONDE.heightContrast },
    uHeightPivot: { value: NATUREL_MONDE.heightPivot },
  },
})
const poserMonde = (g, p) => g.poserRampeMonde(p)
const majMonde = (g) => g._majRampeMonde()

test('⑦c `poserRampeMonde` : sans porteur, le globe est celui d’avant AU BIT PRÈS', () => {
  // ⚠️ **MÊME DISCIPLINE QUE `uCropOn: 0` ET `uHabOn: 0`** : tant que personne
  // ne branche le LUT, `uRampCropOn` vaut 0 et les deux curseurs valent
  // `NATUREL_MONDE`. C'est ce qui garantit que la Tâche R11 ne change RIEN sur
  // les chemins qui ne l'appellent pas — les bancs, les tests, un globe nu.
  const g = globeNu()
  const u = g.uniforms
  poserMonde(g, null)
  assert.equal(u.uRampCropOn.value, 0)
  assert.equal(u.uRampCrop.value, null)

  // ⛔ **LE PORTEUR, PAS LA VALEUR** : `terrain.rebuildRamp` LIBÈRE la texture
  // et en pose une neuve depuis quatre sites. On vérifie donc que le globe suit
  // le remplacement sans être re-branché.
  const porteur = { value: { faux: 'lut A' } }
  poserMonde(g, porteur)
  assert.equal(u.uRampCropOn.value, 1)
  assert.equal(u.uRampCrop.value, porteur.value)
  assert.equal(u.uHeightContrast.value, GRADE_MONDE.heightContrast)
  assert.equal(u.uHeightPivot.value, GRADE_MONDE.heightPivot)

  porteur.value = { faux: 'lut B' }
  majMonde(g)
  assert.equal(u.uRampCrop.value, porteur.value)

  // et l'aller-retour rend l'état d'avant, bit à bit
  poserMonde(g, null)
  assert.equal(u.uRampCropOn.value, 0)
  assert.equal(u.uRampCrop.value, null)
  assert.ok(Object.is(u.uHeightContrast.value, NATUREL_MONDE.heightContrast))
  assert.ok(Object.is(u.uHeightPivot.value, NATUREL_MONDE.heightPivot))
})

test('⑦d le crop garde la main tant qu’il vit', () => {
  // ⚠️ **SANS CETTE GARDE, LE MONDE ÉCRASERAIT LE BLOC À CHAQUE IMAGE.**
  // `_majRampeMonde` tourne dans `update()` ; si elle ne sortait pas sur
  // `this._crop`, elle reposerait `GRADE_MONDE` par-dessus le grade du crop,
  // soixante fois par seconde, et le bloc perdrait son cadrage local.
  const g = globeNu()
  const u = g.uniforms
  poserMonde(g, { value: { faux: 'lut' } })
  g._crop = { cx: 0, cy: 0, demi: 1 }
  u.uHeightContrast.value = 3
  u.uHeightPivot.value = 0.15
  majMonde(g)
  assert.equal(u.uHeightContrast.value, 3)
  assert.equal(u.uHeightPivot.value, 0.15)
})

test('⑦e `retirerHabillage` rend la loi du MONDE, pas le neutre — quand elle est branchée', () => {
  // ⛔ **C'EST ICI QUE LES DEUX MONDES D'ADRIEN SE SÉPARAIENT** : `retirerHabillage`
  // éteignait `uRampCropOn`, donc la sphère repassait à la loi linéaire de la
  // rampe 1D pendant que le bloc indexait `natRampT` sur le LUT 2D.
  const src = readFileSync(new URL('../src/globe.js', import.meta.url), 'utf8')
  const i = src.indexOf('retirerHabillage() {')
  assert.ok(i > 0)
  // ⚠️ **LE CORPS ENTIER, PAS UNE FENÊTRE DE 6 000 CARACTÈRES.** La borne fixe
  // d'origine a fait tomber ce test à la Tâche R22, qui n'a fait qu'AJOUTER un
  // bloc de commentaire quinze lignes plus haut dans la même fonction : le
  // `_rampeMonde` cherché était sorti de la fenêtre alors qu'il n'avait pas
  // bougé d'une ligne. Un test qui tombe sur la LONGUEUR d'un commentaire ne
  // mesure pas ce qu'il croit. On coupe donc à l'accolade fermante de la
  // méthode — le même repère que `crop-habillage` prend pour `contexteCrop`.
  const finCorps = src.indexOf('\n  }\n', i)
  assert.ok(finCorps > i, 'la fin de `retirerHabillage` est introuvable')
  const corps = src.slice(i, finCorps)
  // l'analyse part TOUJOURS (12 Mo par MNT 1536²) ; le LUT, lui, est celui du socle
  assert.match(corps, /u\.uAnalysis\.value = null/)
  assert.match(corps, /u\.uAnalysisOn\.value = 0/)
  assert.match(corps, /this\._rampeMonde\?\.value/)
  // ⛔ et le voile NE suit PAS : `natVoile` lit `length(qCrop)`, une distance au
  // centre d'un crop qui n'existe plus
  assert.match(corps, /u\.uHazeAmt\.value = NATUREL_MONDE\.hazeAmt/)
})


// ══════════ ⑧ LE RECOLLAGE DES DEUX ÉCHELLES — Tâche R31 ═══════════════════
//
// > **Adrien, 2026-09-01 :** *« Il doit y avoir un lien entre ce que l'on voit en
// > crop et ce que l'on voit à grande échelle. »*
//
// ⛔ **SA PRÉMISSE EST FAUSSE, ET C'EST MESURÉ** : les COULEURS suivaient déjà le
// gabarit de loin — les deux régimes lisent la MÊME table `uRampCrop`. Ce qui ne
// suivait pas, c'est l'ÉCHELLE D'ALTITUDE, donc l'INDICE. Relevé le 2026-09-01
// (`scripts/diag-r31-ecart.mjs`, `.banc/R31/ecart-avant.json`, même point du sol,
// même table) : **ΔE 18,0 au rivage, 25,4 à 300 m, 38,5 à 800 m** à La Réunion ;
// **35,8 et 52,4** à Bornéo. Le seuil de perception vaut 2,3.

test('⑧a `poidsRecollage` : nul à la station de l’affiche, plein au cran haut, monotone', () => {
  // ⛔ **LA GARDE DE L'AFFICHE.** Sous 2 048 m le poids est EXACTEMENT zéro, donc
  // `mix(x, y, 0.0)` rend `x` : la vue de composition ne bouge pas d'un bit.
  assert.equal(poidsRecollage(2 ** CRAN_RECOLLAGE_BAS), 0)
  assert.equal(poidsRecollage(1000), 0)
  assert.equal(poidsRecollage(0), 0)
  assert.equal(poidsRecollage(-5), 0)
  assert.equal(poidsRecollage(NaN), 0)
  assert.equal(poidsRecollage(2 ** CRAN_RECOLLAGE_HAUT), 1)
  assert.equal(poidsRecollage(1e9), 1)
  // strictement croissante entre les deux, et jamais hors de [0 ; 1]
  let precedent = -1
  for (let c = CRAN_RECOLLAGE_BAS; c <= CRAN_RECOLLAGE_HAUT; c += 0.05) {
    const w = poidsRecollage(2 ** c)
    assert.ok(w >= 0 && w <= 1, `poids hors bornes au cran ${c} : ${w}`)
    assert.ok(w >= precedent, `le poids RECULE au cran ${c}`)
    precedent = w
  }
  // ⚠️ **C'EST BIEN UN `smoothstep`, PAS UNE RAMPE LINÉAIRE** : à mi-chemin il
  // vaut 0,5 (les deux courbes s'y croisent), mais au quart il vaut 0,15625 et
  // non 0,25. Une rampe linéaire poserait une cassure de pente aux deux bouts.
  const milieu = 2 ** ((CRAN_RECOLLAGE_BAS + CRAN_RECOLLAGE_HAUT) / 2)
  assert.ok(Math.abs(poidsRecollage(milieu) - 0.5) < 1e-12)
  const quart = 2 ** (CRAN_RECOLLAGE_BAS + (CRAN_RECOLLAGE_HAUT - CRAN_RECOLLAGE_BAS) / 4)
  assert.ok(Math.abs(poidsRecollage(quart) - 0.15625) < 1e-12)
})

test('⑧b le recollage est ACHEVÉ avant que le crop puisse mourir — exécuté contre seuil-socle', () => {
  // ⛔ **C'EST LA CONDITION QUI INTERDIT UNE MARCHE.** `retirerRampe` rend le
  // régime mondial d'un seul coup à la mort du crop ; si le recollage n'était pas
  // fini, cette bascule serait visible. Elle ne l'est pas parce que l'image porte
  // DÉJÀ le régime mondial quand elle survient.
  // ⚠️ **LES DEUX BORNES SONT CELLES DU BLOC, PAS CELLES DU CROP — D21.** Ce
  // que ce test garde est un raccord D'IMAGE : la rampe doit avoir rendu le
  // régime mondial avant que le bloc cesse d'occuper l'écran. Depuis D21 le
  // crop naît à 600 km et meurt à 750 km, mais la RAMPE travaille à l'échelle
  // du bloc — ce sont `SEUIL_BLOC_M` / `SEUIL_BLOC_MORT_M`, les deux seuils
  // d'avant D21 au bit près, qui encadrent le recollage.
  const satureA = 2 ** CRAN_RECOLLAGE_HAUT
  assert.ok(satureA >= SEUIL_BLOC_M,
    `le recollage sature à ${satureA} m, avant même l’arrivée au bloc (${SEUIL_BLOC_M} m)`)
  assert.ok(satureA < SEUIL_BLOC_MORT_M,
    `le recollage sature à ${satureA} m, APRÈS la sortie du bloc (${SEUIL_BLOC_MORT_M} m) — il y aurait une marche`)
  // ⚠️ **ET LA BORNE EST CONDITIONNELLE, DONC ON L'ÉCRIT.** Le poids se mesure
  // au-dessus du SOL du crop : il sature à `satureA + terreBas`. La condition
  // tient tant que la terre la plus basse du bloc est sous ce seuil-ci.
  const solMax = SEUIL_BLOC_MORT_M - satureA
  assert.ok(solMax > 7500, `la marge de sol ne vaut que ${solMax} m`)
  // le point le plus bas d'un bloc de 10,4 km ne peut pas dépasser 7 575 m sur
  // Terre : le sommet du monde est à 8 848 m et aucun plateau n'est à ce niveau.
  assert.ok(solMax < 8848)
})

test('⑧c CE QUE J’AI CRU PUIS RÉFUTÉ : l’altitude de recollage n’est PAS `modes.altM`', () => {
  // ⛔ **J'AI D'ABORD RETRANCHÉ LE SOL DU CROP**, en croyant que l'altitude brute
  // donnerait à l'Everest un poids plus fort parce que son sol est haut :
  // `modes.altM` valait 6 138 · 9 331 · 10 864 · 15 094 m aux quatre lieux.
  //
  // ⛔ **FAUX** : ce qui arrive à `poidsRecollage` est `altitudeCadrageM()`, une
  // hauteur AU-DESSUS DE LA SURFACE DU BLOC — la même grandeur que celle sur
  // laquelle `seuil-socle.js` fait naître et mourir le crop. Retourné depuis le
  // poids posé dans l'application vivante (2026-09-01) : **9 310 m à La Réunion
  // (sol 540 m) et 8 796 m à l'Everest (sol 4 928 m)** — neuf kilomètres tous les
  // deux, alors que leurs altitudes d'ellipsoïde diffèrent de 4,2 km.
  const inverse = (w) => {
    // smoothstep⁻¹ : 3t² − 2t³ = w, par bissection — le test ne fait confiance
    // à aucune formule qu'il n'exécute pas.
    let a = 0, b = 1
    for (let k = 0; k < 60; k++) { const m = (a + b) / 2; if (3 * m * m - 2 * m * m * m < w) a = m; else b = m }
    return 2 ** (CRAN_RECOLLAGE_BAS + (a + b) / 2 * (CRAN_RECOLLAGE_HAUT - CRAN_RECOLLAGE_BAS))
  }
  // ⚠️ `inverse` rend l'ENTRÉE de la loi, c'est-à-dire ce que la version fautive
  // lui donnait : `altitudeCadrage − terreBas`. On rajoute donc le sol pour
  // retrouver l'altitude de cadrage elle-même.
  const cadrageReunion = inverse(0.5372682359090186) + 539.6
  const cadrageEverest = inverse(0.13590698503811202) + 4928
  assert.ok(Math.abs(cadrageReunion - 9316) < 20, `La Réunion : ${cadrageReunion} m`)
  assert.ok(Math.abs(cadrageEverest - 8819) < 20, `Everest : ${cadrageEverest} m`)
  // ⛔ **LES DEUX SONT À NEUF KILOMÈTRES**, à 500 m près, quand leurs altitudes
  // d'ellipsoïde diffèrent de 4,2 km (10 864 contre 15 094). C'est la preuve que
  // `altitudeCadrageM()` ne porte PAS l'élévation du sol.
  assert.ok(Math.abs(cadrageReunion - cadrageEverest) < 600)
  assert.ok(Math.abs(10864 - 15094) > 4000)
  // ⛔ **ET LA CONSÉQUENCE CHIFFRÉE DE L'ERREUR** : retrancher un sol de 4 928 m à
  // une altitude qui ne le contient pas faisait tomber le poids de 0,54 à 0,14 —
  // le recollage s'éteignait sur le seul lieu haut, sans raison visuelle.
  assert.ok(Math.abs(poidsRecollage(cadrageEverest) - 0.54) < 0.01, `${poidsRecollage(cadrageEverest)}`)
  assert.ok(Math.abs(poidsRecollage(cadrageEverest - 4928) - 0.1359) < 0.01, `${poidsRecollage(cadrageEverest - 4928)}`)
  // ➡️ **LA FONCTION A ÉTÉ RETIRÉE, PAS CORRIGÉE**, et le module ne lit plus
  // aucune grandeur de terrain pour décider du poids.
  const src = readFileSync(new URL('../src/monde/rampe-crop.js', import.meta.url), 'utf8')
  const code = src.replace(/\/\*[\s\S]*?\*\//g, '').replace(/^\s*\/\/.*$/gm, '')
  assert.ok(!/hauteurSurSolCrop/.test(code), 'la fonction réfutée est encore dans le code')
  assert.ok(!/terreBas/.test(code.slice(code.indexOf('export function poidsRecollage'))),
    'poidsRecollage ne doit lire aucune grandeur de terrain')
})

test('⑧d le nuanceur MÉLANGE les deux INDICES sur `uRecollage` — extrait et exécuté', () => {
  // ⚠️ **ON EXÉCUTE LA LIGNE DU NUANCEUR, ON NE CHERCHE PAS SON NOM** — c'est le
  // protocole de ②b, et c'est ce qui a évité huit assertions vertes sur de la
  // prose ailleurs dans ce fichier.
  const ligne = /rampT = mix\(rampT, rampTMonde, uRecollage\);/.exec(globeSrc)
  assert.ok(ligne, 'le mélange de recollage a disparu du nuanceur')
  const MIX = (x, y, t) => x * (1 - t) + y * t
  // eslint-disable-next-line no-new-func
  const f = new Function('rampT', 'rampTMonde', 'uRecollage', 'MIX',
    `${ligne[0].replace(/^rampT = mix\(/, 'rampT = MIX(')} return rampT`)
  // ⛔ **À POIDS NUL, L'AFFICHE EST INTOUCHÉE AU BIT PRÈS** — `Object.is`, pas
  // une tolérance : `mix(x, y, 0.0)` vaut `x·1 + y·0`.
  for (const t of [0, 0.13, 0.5, 0.77, 1]) {
    assert.ok(Object.is(f(t, 0.9, 0, MIX), t), `poids nul : ${t} devient ${f(t, 0.9, 0, MIX)}`)
  }
  assert.equal(f(0.13, 0.9, 1, MIX), 0.9, 'poids plein : c’est le régime du monde')
  // et le mélange est BORNÉ par ses deux entrées, donc jamais hors de [0 ; 1]
  for (let w = 0; w <= 1; w += 0.05) {
    const v = f(0.13, 0.9, w, MIX)
    assert.ok(v >= 0.13 - 1e-12 && v <= 0.9 + 1e-12, `mélange hors bornes à w=${w} : ${v}`)
  }
  // ⚠️ **ET LE DÉPARTAGE SPATIAL RESTE LE DERNIER** : le recollage vit DANS le
  // crop, `dedansCrop` décide ensuite du dedans et du dehors. Inverser les deux
  // aurait fait glisser la planète entière avec l'altitude du bloc.
  const iRec = globeSrc.indexOf('rampT = mix(rampT, rampTMonde, uRecollage);')
  const iCrop = globeSrc.indexOf('rampT = mix(rampTMonde, rampT, dedansCrop);')
  assert.ok(iRec > 0 && iCrop > iRec, 'le mélange `dedansCrop` doit venir APRÈS le recollage')
})

test('⑧e sans altitude `uRecollage` reste NUL ; avec elle il suit la loi ; `retirerRampe` le rend', () => {
  // ⚠️ **EXERCÉ SUR LE VRAI POSEUR**, pas grepé — même patron que ②g.
  const g = faussGlobe(REPERE, () => 800)
  assert.equal(g.uniforms.uRecollage.value, 0)
  // le chemin des bancs et du réglage manuel : pas d'altitude, pas de recollage
  poser(g, { echelle: { terreBas: 0, terreHaut: 3000, profondeur: 100, creux: 100, plancherM: 0 } })
  assert.equal(g.uniforms.uRecollage.value, 0, 'poserRampe sans altitude ne doit RIEN recoller')
  // avec une altitude, il vaut la loi — évaluée, pas approchée
  const e = { terreBas: 539.6, terreHaut: 3052.3, profondeur: 0, creux: 0, plancherM: 0 }
  poser(g, { echelle: e, altitudeM: 10864 })
  assert.equal(g.uniforms.uRecollage.value, poidsRecollage(10864))
  assert.ok(g.uniforms.uRecollage.value > 0.63 && g.uniforms.uRecollage.value < 0.66)
  // ⛔ **ET IL RETOMBE AVEC LA RAMPE** : un poids vivant au-dessus d'un état mort
  // est le défaut C-3 de la Tâche C, et `retirerRampe` est appelé à chaque mort
  // de crop.
  Globe.prototype.retirerRampe.call({
    uniforms: g.uniforms,
    _echelleContinue: g._echelleContinue,
    planeteEclairee: false,
  })
  assert.equal(g.uniforms.uRecollage.value, 0, 'retirerRampe laisse un poids de recollage vivant')
})

test('⑧f LE CHIFFRE DE L’APLAT : 990 m de terre d’une seule couleur, et ce que le recollage en fait', () => {
  // ⚡ **RELEVÉ DANS L'APPLICATION VIVANTE**, La Réunion z13, 2026-09-01,
  // `.banc/R31/ecart-avant.json` — les uniformes VIVANTS, pas une hypothèse.
  const U = { reliefBas: 539.6, landMax: 3052.3, pivot: 0.39, contraste: 2.4, altM: 10864 }
  const amplitude = U.landMax - U.reliefBas
  const hNorm = (h) => CLAMP((h - U.reliefBas) / amplitude, 0, 1)
  const pivot = Math.max(U.pivot, plancherPivot((0 - U.reliefBas) / amplitude))
  assert.equal(pivot, U.pivot, 'le plancher de pivot ne mord pas ici — sinon le chiffre change')
  const tCrop = (h) => rampeTSocleTest(hNorm(h), pivot, U.contraste)
  // ⛔ **AVANT : L'INDICE EST CONSTANT — DONC UNE SEULE COULEUR — DE 0 À 990 m.**
  for (const h of [0, 100, 300, 500, 800, 990]) assert.equal(tCrop(h), 0, `${h} m devrait saturer`)
  const seuil = (pivot - 0.5 / U.contraste) * amplitude + U.reliefBas
  assert.ok(Math.abs(seuil - 996) < 1.5, `la sortie de saturation vaut ${seuil} m`)

  // ⚡ **APRÈS** : à l'altitude relevée, le poids vaut ce que la loi dit, et le
  // mélange rend l'indice STRICTEMENT croissant sur toute la tranche.
  // ⚠️ **LE POIDS EST CELUI QUI A ÉTÉ RELEVÉ DANS LA PAGE**, pas une valeur
  // choisie : `uRecollage` valait 0,5373 à cette vue (altitude de cadrage
  // 9 310 m). On le recalcule par la loi pour que le test tombe avec elle.
  const w = poidsRecollage(9310)
  assert.ok(w > 0.55 && w < 0.58, `le poids relevé vaut ${w}`)
  const tRecolle = (h) => tCrop(h) * (1 - w) + rampeTMonde(h) * w
  let precedent = -1
  for (let h = 0; h <= 990; h += 10) {
    const t = tRecolle(h)
    assert.ok(t > precedent, `l’indice recollé n’avance pas à ${h} m`)
    precedent = t
  }
  // et l'amplitude gagnée est LISIBLE : la table fait 512 texels de large.
  const gagne = tRecolle(990) - tRecolle(0)
  assert.ok(gagne > 0.2, `le recollage n’étale la tranche que de ${gagne}`)
  assert.ok(gagne * 512 > 100, 'moins de cent texels de rampe : ce serait encore un aplat')
})
