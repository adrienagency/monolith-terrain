// L'ESTOMPAGE DE LA TERRE AUTOUR — Tâche G du plan « UNE SEULE TERRE »
// (`docs/superpowers/plans/2026-08-21-terre-unique.md`).
//
// ══════════ CE QUE CE FICHIER GARDE ════════════════════════════════════════
//
//   ① LA LOI — `estompageTerre` ne lit QU'UNE ALTITUDE (règle R1), elle est
//      monotone, elle vaut 0 au-dessus du début et 1 au-dessous de la fin, et
//      elle est CONTINUE aux deux raccords : un saut se verrait à l'écran.
//   ② LES DEUX BORNES SE DÉRIVENT — elles ne sont pas posées en chiffres. Elles
//      descendent de `seuil-socle.js` (`SEUIL_MORT_M` et `altitudePourFraction`),
//      donc du champ de vision canonique `FOV_DEG = 30` et de la largeur du
//      socle. Si l'une bouge sans l'autre, le test tombe.
//   ③ L'ORDRE DES TROIS ALTITUDES — le fondu COMMENCE avant que le socle naisse
//      et FINIT après. C'est la seule chose qui rend le mot « progressivement »
//      du cahier des charges vérifiable.
//   ④ LA VEILLE — l'orbite force zéro (la planète y est le sujet), une altitude
//      non finie conserve l'état, et `appliquer` n'est rappelé que sur
//      changement.
//   ⑤ LE NUANCEUR — les trois sites de `globe.js` (tuiles, atmosphère,
//      calottes) sont EXTRAITS PUIS EXÉCUTÉS, pas grepés. C'est le patron de la
//      Tâche D (`test/crop-rampe.test.js`), et c'est le seul qui fasse tomber une
//      mutation de COMPORTEMENT plutôt que de chaîne.
//   ⑥ L'ÉTEINT EST L'ANCIEN — `uEstompageOn` à 0 rend, sur les trois sites, la
//      valeur d'avant la Tâche G au bit près. C'est la garde que `uCropOn`,
//      `uHabOn` et `uMerRampeOn` portent déjà, et pour la même raison.
//   ⑦ `poserEstompage` / `retirerEstompage` sont EXERCÉES sur un globe minimal.
//
// ⚠️ **CE QUI RESTE HORS DE PORTÉE, ET IL FAUT LE DIRE** : que le GPU exécute
// bien ce texte, et que l'image qui en sort soit belle. Seul l'écran le dit ;
// l'étape « regarder l'écran » de la tâche est là pour ça, et son compte rendu
// aussi.
//
// ⚠️ **ET CE QUE CE FICHIER NE PEUT PAS TESTER NON PLUS** : le branchement dans
// `src/main.js`. **Aucun test de ce dépôt ne charge `main.js`** — c'est écrit au
// §0 du plan. On en vérifie donc le TEXTE, comme `test/crop-habillage.test.js`
// le fait déjà, et on charge la page à la main avant de commiter.

import test from 'node:test'
import assert from 'node:assert/strict'
import { readFileSync } from 'node:fs'

import { Globe } from '../src/globe.js'
import {
  ALT_ESTOMPAGE_DEBUT_M,
  ALT_ESTOMPAGE_FIN_M,
  FRACTION_ESTOMPAGE_PLEINE,
  creerVeilleEstompage,
  estompageTerre,
} from '../src/monde/estompage-terre.js'
import {
  LARGEUR_SOCLE_M,
  SEUIL_MORT_M,
  SEUIL_NAISSANCE_M,
  SEUIL_BLOC_M,
  SEUIL_BLOC_MORT_M,
  altitudePourFraction,
  fractionEcran,
} from '../src/monde/seuil-socle.js'

const SRC_GLOBE = new URL('../src/globe.js', import.meta.url)
const SRC_CLOUDS = new URL('../src/globe-clouds.js', import.meta.url)
const SRC_MAIN = new URL('../src/main.js', import.meta.url)
const SRC_MODULE = new URL('../src/monde/estompage-terre.js', import.meta.url)
const GLOBE = readFileSync(SRC_GLOBE, 'utf8')
const MAIN = readFileSync(SRC_MAIN, 'utf8')

// ══════════ ① LA LOI ═══════════════════════════════════════════════════════

test('①a au-dessus du début, la planète est ENTIÈRE — zéro estompage', () => {
  for (const a of [ALT_ESTOMPAGE_DEBUT_M, ALT_ESTOMPAGE_DEBUT_M + 1, 1e5, 1e7]) {
    assert.equal(estompageTerre({ altitudeEllipsoideM: a }), 0, `alt ${a}`)
  }
})

test('①b au-dessous de la fin, il ne reste QUE le crop — estompage plein', () => {
  for (const a of [ALT_ESTOMPAGE_FIN_M, ALT_ESTOMPAGE_FIN_M - 1, 2000, 0, -500]) {
    assert.equal(estompageTerre({ altitudeEllipsoideM: a }), 1, `alt ${a}`)
  }
})

test('①c STRICTEMENT monotone dans la bande — un palier serait un cran', () => {
  // ⚠️ MUTATION VISÉE : remplacer la rampe par une constante, ou inverser le
  // sens. Les deux tombent ici, et aucune ne déplace une chaîne.
  const n = 400
  let precedent = -1
  for (let i = 0; i <= n; i++) {
    // on descend : de DEBUT vers FIN, donc l'estompage doit MONTER
    const alt = ALT_ESTOMPAGE_DEBUT_M + (ALT_ESTOMPAGE_FIN_M - ALT_ESTOMPAGE_DEBUT_M) * (i / n)
    const f = estompageTerre({ altitudeEllipsoideM: alt })
    assert.ok(f >= precedent, `l'estompage recule à ${alt} m : ${f} < ${precedent}`)
    if (i > 0 && i < n) assert.ok(f > precedent, `palier à ${alt} m — un palier est un cran`)
    precedent = f
  }
  assert.equal(precedent, 1)
})

test('①d CONTINUE aux deux raccords — un saut se verrait à l’écran', () => {
  // ⚠️ Un `smoothstep` a une dérivée nulle aux bouts : la valeur ET la pente se
  // raccordent. On vérifie la VALEUR (un saut de luminosité) et la PENTE (un
  // à-coup dans le mouvement), sur un pas de un mètre.
  const eps = 1
  const hautDedans = estompageTerre({ altitudeEllipsoideM: ALT_ESTOMPAGE_DEBUT_M - eps })
  assert.ok(hautDedans < 1e-4, `saut au raccord haut : ${hautDedans}`)
  const basDedans = estompageTerre({ altitudeEllipsoideM: ALT_ESTOMPAGE_FIN_M + eps })
  assert.ok(basDedans > 1 - 1e-4, `saut au raccord bas : ${basDedans}`)
})

test('①f LE FONDU COURT SUR LE LOGARITHME — il est à moitié fait à la moyenne GÉOMÉTRIQUE', () => {
  // ⚠️ **C'EST L'ASSERTION QUI DISTINGUE LA LOI DE SA VOISINE ÉVIDENTE**, et
  // aucune des autres ne le fait. Une rampe LINÉAIRE EN MÈTRES passe tous les
  // tests d'encadrement — monotone, bornée, continue, entamée à la naissance du
  // socle — et se trompe pourtant de forme : elle irait vite en haut et
  // lentement en bas, alors que la descente de ce dépôt est GÉOMÉTRIQUE
  // (`echelonsGeometriques`, un cran divise l'altitude par deux).
  //
  // Le départage est exact : sur le logarithme, le milieu de la bande est la
  // moyenne GÉOMÉTRIQUE des deux bornes, et `smoothstep(0,5) = 0,5` pile. Une
  // rampe linéaire en mètres y rendrait **0,6345** — rejoué dans ce test.
  const geo = Math.sqrt(ALT_ESTOMPAGE_DEBUT_M * ALT_ESTOMPAGE_FIN_M)
  assert.ok(
    Math.abs(estompageTerre({ altitudeEllipsoideM: geo }) - 0.5) < 1e-12,
    `le fondu n'est pas à moitié fait à ${Math.round(geo)} m : ${estompageTerre({ altitudeEllipsoideM: geo })}`
  )
  // le témoin : ce que la loi linéaire en mètres rendrait au même endroit
  const tLin = (ALT_ESTOMPAGE_DEBUT_M - geo) / (ALT_ESTOMPAGE_DEBUT_M - ALT_ESTOMPAGE_FIN_M)
  const lin = tLin * tLin * (3 - 2 * tLin)
  assert.ok(Math.abs(lin - 0.5) > 0.1, 'le témoin ne distingue plus rien — ce test ne prouve plus rien')
})

test('①g LE RACCORD EST UN `smoothstep`, PAS UNE PENTE DROITE', () => {
  // ⚠️ Autre voisine évidente : garder le logarithme mais laisser `t` tel quel.
  // Elle passe la continuité (la VALEUR se raccorde) et la monotonie — elle rate
  // la PENTE, donc l'à-coup au moment où le fondu s'amorce. Aux quarts de la
  // bande, `smoothstep` rend 0,15625 et 0,84375 ; la droite rendrait 0,25 et 0,75.
  const altPourT = (t) => ALT_ESTOMPAGE_DEBUT_M * (ALT_ESTOMPAGE_FIN_M / ALT_ESTOMPAGE_DEBUT_M) ** t
  const bas = estompageTerre({ altitudeEllipsoideM: altPourT(0.25) })
  const haut = estompageTerre({ altitudeEllipsoideM: altPourT(0.75) })
  assert.ok(Math.abs(bas - 0.15625) < 1e-12, `au quart de la bande : ${bas}`)
  assert.ok(Math.abs(haut - 0.84375) < 1e-12, `aux trois quarts de la bande : ${haut}`)
})

test('①e une altitude NON FINIE conserve l’état — même contrat que socleVisible', () => {
  for (const a of [NaN, Infinity, -Infinity, undefined, null, '32000']) {
    assert.equal(estompageTerre({ altitudeEllipsoideM: a, estompageAvant: 0.37 }), 0.37, `alt ${a}`)
  }
  assert.equal(estompageTerre({}), 0, 'sans rien, l’estompage de départ est zéro')
})

// ══════════ ② LES DEUX BORNES SE DÉRIVENT ══════════════════════════════════

test('②a le début du fondu EST l’hystérésis de l’ARRIVÉE AU BLOC, pas un chiffre voisin', () => {
  // ⚠️ **DEPUIS D21 CE N'EST PLUS `SEUIL_MORT_M`, ET LE CHIFFRE NE BOUGE PAS.**
  // D21 fait naître le crop au palier z7 : `SEUIL_MORT_M` vaut 750 km. Y
  // accrocher le fondu effacerait la planète en vue RÉGIONALE — 0,576 à 100 km
  // au lieu de 0. Le fondu suit la GRANDEUR DU SOCLE À L'IMAGE, pas la
  // naissance de sa géométrie.
  assert.equal(ALT_ESTOMPAGE_DEBUT_M, SEUIL_BLOC_MORT_M)
  assert.ok(Math.abs(ALT_ESTOMPAGE_DEBUT_M - 40342.8) < 0.1, 'la valeur d’avant D21, au bit près')
  assert.ok(ALT_ESTOMPAGE_DEBUT_M < SEUIL_MORT_M)
  // ⛔ la mesure qui a tranché : à 100 km la Terre reste ENTIÈRE
  assert.equal(estompageTerre({ altitudeEllipsoideM: 100_000 }), 0)
})

test('②b la fin du fondu est l’altitude où le socle occupe TOUTE la hauteur', () => {
  assert.equal(FRACTION_ESTOMPAGE_PLEINE, 1)
  assert.equal(
    ALT_ESTOMPAGE_FIN_M,
    altitudePourFraction({ largeurM: LARGEUR_SOCLE_M, fraction: FRACTION_ESTOMPAGE_PLEINE })
  )
  // et le sens géométrique se rejoue, pas seulement l'égalité de formule
  assert.ok(
    Math.abs(fractionEcran({ largeurM: LARGEUR_SOCLE_M, altitudeM: ALT_ESTOMPAGE_FIN_M }) - 1) < 1e-12
  )
})

test('②c aucune des deux bornes n’est écrite en dur dans le module', () => {
  // ⚠️ La régression se glisserait dans une recopie : quelqu'un fige 40343 et
  // les seuils divergent en silence le jour où `blockExtentMeters` bouge.
  const src = readFileSync(SRC_MODULE, 'utf8')
  const code = src.replace(/\/\/[^\n]*/g, ' ')
  const chiffres = code.match(/\b\d{4,}(?:[.,]\d+)?\b/g) || []
  assert.deepEqual(chiffres, [], `des altitudes en dur dans le code : ${chiffres.join(', ')}`)
})

test('②d RÈGLE R1 — le module ne connaît ni fraction d’écran, ni débit, ni zoom effectif', () => {
  const src = readFileSync(SRC_MODULE, 'utf8')
  const code = src.replace(/\/\/[^\n]*/g, ' ')
  for (const interdit of ['meanM', 'debitObserve', 'zoomEffectif', 'innerHeight', 'aspect', 'fractionEcran']) {
    assert.ok(!code.includes(interdit), `le module lit \`${interdit}\` — c'est la règle R1 qui tombe`)
  }
  // le seul import autorisé est le producteur de seuils
  const imports = [...code.matchAll(/from\s+'([^']+)'/g)].map((m) => m[1])
  assert.deepEqual(imports, ['./seuil-socle.js'])
})

// ══════════ ③ L'ORDRE DES TROIS ALTITUDES ══════════════════════════════════

test('③a le fondu COMMENCE avant que le socle naisse, et FINIT après', () => {
  // ⚠️ **L'ALTITUDE DE RÉFÉRENCE EST `SEUIL_BLOC_M` DEPUIS D21** — c'est elle
  // qui porte le sens « le socle occupe une part importante de l'image », et
  // c'est l'ancien `SEUIL_NAISSANCE_M` au bit près.
  assert.ok(ALT_ESTOMPAGE_FIN_M < SEUIL_BLOC_M, 'le fondu finirait avant l’arrivée au bloc')
  assert.ok(SEUIL_BLOC_M < ALT_ESTOMPAGE_DEBUT_M, 'le fondu commencerait après l’arrivée au bloc')
  // ⛔ et la naissance du crop, elle, est TRÈS au-dessus du fondu : à 600 km la
  // planète est entière. C'est le départage de D21, lu par ce module.
  assert.ok(SEUIL_NAISSANCE_M > ALT_ESTOMPAGE_DEBUT_M)
  assert.equal(estompageTerre({ altitudeEllipsoideM: SEUIL_NAISSANCE_M }), 0)
})

test('③b à l’arrivée au bloc, la Terre autour est ENTAMÉE mais encore là', () => {
  // ⚠️ C'est la propriété PERCEPTIVE de la tâche : le bloc se détache pendant
  // qu'on descend, il n'apparaît pas dans un écran déjà vide. Les deux bornes
  // sont larges exprès — c'est un encadrement, pas un chiffre-titre.
  const f = estompageTerre({ altitudeEllipsoideM: SEUIL_BLOC_M })
  assert.ok(f > 0.05 && f < 0.5, `estompage à l’arrivée au bloc : ${f}`)
})

// ══════════ ④ LA VEILLE ════════════════════════════════════════════════════

function veilleDeTest() {
  const vus = []
  const v = creerVeilleEstompage({ appliquer: (f) => vus.push(f) })
  return { v, vus }
}

test('④0 la veille part de ZÉRO et n’applique RIEN — la planète est entière au chargement', () => {
  const { v, vus } = veilleDeTest()
  assert.equal(v.valeur, 0)
  assert.equal(v.auSeuil, 0)
  assert.equal(v.applications, 0, 'la veille a écrit un uniforme avant que rien ne bouge')
  assert.deepEqual(vus, [])
})

test('④a l’orbite force ZÉRO — la planète y est le sujet, pas le décor', () => {
  const { v } = veilleDeTest()
  v.maj(ALT_ESTOMPAGE_FIN_M)
  assert.equal(v.valeur, 1)
  v.poserMode(false)
  assert.equal(v.valeur, 0, 'en orbite la Terre doit être entière')
})

test('④b en orbite, `maj` ne décide RIEN — l’altitude y est un résidu', () => {
  const { v } = veilleDeTest()
  v.poserMode(false)
  v.maj(ALT_ESTOMPAGE_FIN_M)
  assert.equal(v.valeur, 0)
  // et le retour en surface tranche sur la DERNIÈRE altitude de surface, pas
  // sur celle qu'on a poussée en orbite
  v.poserMode(true)
  assert.equal(v.valeur, 0, 'l’orbite a laissé passer une altitude')
})

test('④c `appliquer` n’est rappelé QUE sur changement', () => {
  const { v, vus } = veilleDeTest()
  v.maj(1e6)
  v.maj(1e6)
  v.maj(1e6)
  assert.deepEqual(vus, [], 'zéro reste zéro : rien à appliquer')
  v.maj(ALT_ESTOMPAGE_FIN_M)
  assert.deepEqual(vus, [1])
  v.maj(ALT_ESTOMPAGE_FIN_M - 1)
  assert.deepEqual(vus, [1], 'la même valeur a été réappliquée')
})

test('④d une altitude non finie conserve la valeur POSÉE, pas la valeur nulle', () => {
  const { v, vus } = veilleDeTest()
  v.maj(ALT_ESTOMPAGE_FIN_M)
  assert.equal(v.valeur, 1)
  v.maj(NaN)
  assert.equal(v.valeur, 1)
  assert.deepEqual(vus, [1])
})

test('④e un branchement muet est un branchement absent', () => {
  assert.throws(() => creerVeilleEstompage({}), TypeError)
})

// ══════════ ⑤ LE NUANCEUR, EXTRAIT PUIS EXÉCUTÉ ════════════════════════════
//
// ⚠️ **PAS UN GREP DE NOM.** On prend le TEXTE du GLSL, on le traduit
// mécaniquement en JS et on l'APPELLE. Une garde retirée, un `mix` inversé, un
// `1.0 -` effacé changent alors une VALEUR, et l'assertion tombe. C'est la
// leçon du Tour 1 de la Tâche C : « une mutation doit changer le COMPORTEMENT,
// pas la CHAÎNE qu'une assertion cherche ».

function MIX(a, b, t) {
  return a * (1 - t) + b * t
}

/** Une expression GLSL scalaire, rendue exécutable. */
function loi(expr, noms) {
  const js = expr
    .replace(/\/\/[^\n]*/g, ' ')
    .replace(/\s+/g, ' ')
    .replace(/\bmix\s*\(/g, 'MIX(')
    .replace(/\bmax\s*\(/g, 'Math.max(')
    .replace(/\bmin\s*\(/g, 'Math.min(')
    .trim()
  // eslint-disable-next-line no-new-func
  const f = new Function(...noms, 'MIX', `return (${js});`)
  return (args) => f(...noms.map((n) => args[n]), MIX)
}

/** L'affectation `float <nom> = … ;` du nuanceur, prise au texte. */
function affectation(src, nom) {
  const i = src.indexOf(`float ${nom} = `)
  assert.ok(i >= 0, `le nuanceur doit porter « float ${nom} = »`)
  const j = src.indexOf(';', i)
  assert.ok(j > i, `« float ${nom} » n'est pas terminée`)
  return src.slice(i + `float ${nom} = `.length, j)
}

test('⑤a LES TUILES — `couvertureCrop` interpole entre la planète ENTIÈRE et le crop SEUL', () => {
  const estompe = loi(affectation(GLOBE, 'estompeTuile'), ['uEstompageOn', 'uEstompage'])
  const couverture = loi(affectation(GLOBE, 'couvertureTuile'), ['dedans', 'estompeTuile'])

  // ÉTEINT : c'est la Tâche A, au bit près — couvertureCrop === dedans
  const eteint = estompe({ uEstompageOn: 0, uEstompage: 0.42 })
  assert.equal(eteint, 1, 'éteint, l’estompage des tuiles doit valoir 1 (la Tâche A)')
  for (const dedans of [0, 0.25, 0.5, 1]) {
    assert.equal(couverture({ dedans, estompeTuile: eteint }), dedans, `dedans=${dedans}`)
  }

  // ALLUMÉ à 1 : identique à l'éteint — le crop seul
  const plein = estompe({ uEstompageOn: 1, uEstompage: 1 })
  assert.equal(plein, 1)
  assert.equal(couverture({ dedans: 0, estompeTuile: plein }), 0, 'hors du crop, rien ne doit rester')

  // ALLUMÉ à 0 : la planète ENTIÈRE, y compris hors du crop
  const nul = estompe({ uEstompageOn: 1, uEstompage: 0 })
  assert.equal(nul, 0)
  assert.equal(couverture({ dedans: 0, estompeTuile: nul }), 1, 'à estompage nul la Terre autour doit être OPAQUE')
  assert.equal(couverture({ dedans: 1, estompeTuile: nul }), 1)

  // ENTRE LES DEUX : hors du crop, l'opacité vaut exactement 1 − estompage,
  // et DANS le crop elle reste 1 quoi qu'il arrive.
  for (const e of [0.1, 0.25, 0.5, 0.75, 0.9]) {
    const eu = estompe({ uEstompageOn: 1, uEstompage: e })
    assert.ok(Math.abs(couverture({ dedans: 0, estompeTuile: eu }) - (1 - e)) < 1e-12, `dehors à e=${e}`)
    assert.equal(couverture({ dedans: 1, estompeTuile: eu }), 1, `le crop s’estompe aussi à e=${e}`)
  }
})

test('⑤b L’ATMOSPHÈRE — c’est ELLE la « grosse boule laiteuse », et elle s’éteint', () => {
  // ⚠️ Le relevé du chantier nomme l'atmosphère comme cause exacte du défaut :
  // la coquille est à R×1,04, soit 255 km d'altitude, et la caméra est DEDANS
  // sur toute la bande d'estompage (19 → 40 km). Vue de l'intérieur, une
  // coquille BackSide additive remplit tout le cadre.
  const estompe = loi(affectation(GLOBE, 'estompeCiel'), ['uEstompageOn', 'uEstompage'])
  assert.equal(estompe({ uEstompageOn: 0, uEstompage: 0.42 }), 0, 'éteinte, l’atmosphère doit être ENTIÈRE')
  assert.equal(estompe({ uEstompageOn: 1, uEstompage: 0 }), 0)
  assert.equal(estompe({ uEstompageOn: 1, uEstompage: 1 }), 1)

  // LE FACTEUR, EXÉCUTÉ LUI AUSSI — `estompeCiel` inversé rendrait une
  // atmosphère qui s'ALLUME en descendant, et un test de chaîne ne le verrait
  // pas. Ici la valeur tombe.
  const voile = loi(affectation(GLOBE, 'voileCiel'), ['estompeCiel'])
  assert.equal(voile({ estompeCiel: 0 }), 1, 'éteinte, l’atmosphère n’est pas à pleine intensité')
  assert.equal(voile({ estompeCiel: 1 }), 0, 'à estompage plein, l’atmosphère doit être ÉTEINTE')
  assert.equal(voile({ estompeCiel: 0.25 }), 0.75)

  // et le facteur doit ATTEINDRE la couleur : un voile calculé puis jeté serait
  // un `smoothstep` mort à côté du bogue. Cette assertion-là ne peut être qu'un
  // texte — c'est le câblage, pas la loi.
  assert.ok(
    /gl_FragColor = vec4\(col \* a \* voileCiel, 1\.0\);/.test(GLOBE),
    'le voile n’atteint pas la couleur de l’atmosphère'
  )
})

test('⑤c LES CALOTTES — elles suivent, sinon un bandeau blanc OPAQUE reste au pôle', () => {
  const estompe = loi(affectation(GLOBE, 'estompeCalotte'), ['uEstompageOn', 'uEstompage'])
  assert.equal(estompe({ uEstompageOn: 0, uEstompage: 0.42 }), 0, 'éteintes, les calottes doivent être OPAQUES')
  assert.equal(estompe({ uEstompageOn: 1, uEstompage: 1 }), 1)
  const voile = loi(affectation(GLOBE, 'voileCalotte'), ['estompeCalotte'])
  assert.equal(voile({ estompeCalotte: 0 }), 1, 'éteintes, les calottes ne sont plus opaques')
  assert.equal(voile({ estompeCalotte: 1 }), 0, 'à estompage plein, les calottes doivent disparaître')
  assert.ok(
    // ⚠️ le plancher de nuit est un UNIFORME depuis la Tâche R7 (tour de
    // correction) ; à `uNuitCarte = 0,10` et `uNuitFond = uShadowColor`, c'est
    // l'expression d'avant AU BIT PRÈS. Voir `monde/soleil-monde.js`.
    /gl_FragColor = vec4\(mix\(uNuitFond, col, uNuitCarte \+ \(1\.0 - uNuitCarte\) \* day\), voileCalotte\);/.test(GLOBE),
    'le voile n’atteint pas l’alpha de la calotte'
  )
})

test('⑤d LES TROIS SITES lisent les MÊMES deux uniformes — pas trois lois parallèles', () => {
  for (const nom of ['uEstompage', 'uEstompageOn']) {
    const decl = GLOBE.match(new RegExp(`uniform float ${nom};`, 'g')) || []
    assert.ok(decl.length >= 3, `\`${nom}\` n'est déclaré que ${decl.length} fois — il faut les trois sites`)
  }
})

// ══════════ ⑥ L'ÉTEINT EST L'ANCIEN ════════════════════════════════════════

test('⑥a `uEstompageOn` vaut ZÉRO par défaut — sans `poserEstompage`, rien ne change', () => {
  const i = GLOBE.indexOf('uEstompageOn: { value:')
  assert.ok(i >= 0, 'pas de déclaration d’uniforme `uEstompageOn`')
  assert.ok(/uEstompageOn: \{ value: 0 \}/.test(GLOBE), '`uEstompageOn` ne part pas de zéro')
})

test('⑥c LA VALEUR AU REPOS EST LA MÊME DES DEUX CÔTÉS — construction et retrait', () => {
  // ⚠️ **CORRECTION DE CAMPAGNE, ET LE DÉFAUT ÉTAIT RÉEL.** Une mutation qui
  // faisait naître `uEstompage` à 0 au lieu de 1 SURVIVAIT : tant que
  // `uEstompageOn` vaut 0, les trois nuanceurs ignorent `uEstompage`, donc sa
  // valeur initiale n'est observable par AUCUNE image. Elle n'est pourtant pas
  // libre : elle doit être celle que `retirerEstompage` remet, sinon le globe
  // n'a pas le même état au chargement qu'après un aller-retour — et la
  // divergence ne se verrait qu'une fois `uEstompageOn` allumé.
  const decl = GLOBE.match(/uEstompage: \{ value: ([0-9.]+) \}/)
  assert.ok(decl, 'pas de déclaration d’uniforme `uEstompage`')
  const g = globeStub()
  g.uniforms.uEstompage.value = 0.37 // une valeur quelconque, pour partir d'ailleurs
  retirer(g)
  assert.equal(
    Number(decl[1]),
    g.uniforms.uEstompage.value,
    'la valeur au repos du constructeur et celle de `retirerEstompage` ont divergé'
  )
})

test('⑥b les NUAGES ne sont PAS touchés, et c’est une MESURE, pas un oubli', () => {
  // ⚠️ Relevé de la Tâche G : `GlobeClouds.update` éteint déjà sa couverture par
  // la DISTANCE — `smoothstep01(radius × 1,18, radius × 1,5, d)`. À R_GLOBE =
  // 100 unités pour 6 371 km, la borne basse tombe à 18 unités, soit
  // 1 147 km d'altitude : les nuages du globe sont déjà à zéro sur TOUTE la
  // bande d'estompage (19 → 40 km). Y ajouter un facteur serait du code mort,
  // et ce chantier en a trouvé quatre. **Si cette loi change, ce test tombe et
  // la question se rouvre.**
  const src = readFileSync(SRC_CLOUDS, 'utf8')
  assert.ok(
    /uFade\.value = smoothstep01\(this\.radius \* 1\.18, this\.radius \* 1\.5, d\)/.test(src),
    'la loi de fondu des nuages a changé — rouvrir la question de l’estompage'
  )
  assert.ok(!/uEstompage/.test(src), 'les nuages portent un estompage devenu mort')
})

// ══════════ ⑦ `poserEstompage` / `retirerEstompage`, EXERCÉES ══════════════

const val = (v) => ({ value: v })

// ⚠️ **`Object.create(Globe.prototype)` ET PAS UN OBJET NU** : `poserEstompage`
// délègue à `_melangeCalottes`, qui vit sur le prototype. Un `.call` sur un
// objet nu aurait levé — et l'aurait fait pour la mauvaise raison.
function globeStub() {
  const calotte = (n) => ({ name: n, material: { transparent: false, needsUpdate: false } })
  return Object.assign(Object.create(Globe.prototype), {
    uniforms: { uEstompage: val(1), uEstompageOn: val(0) },
    _calottes: [calotte('cap-n'), calotte('cap-s')],
  })
}
const poser = (g, f) => g.poserEstompage(f)
const retirer = (g) => g.retirerEstompage()

test('⑦a `poserEstompage` ALLUME et POSE — sinon elle ne fait rien du tout', () => {
  const g = globeStub()
  poser(g, 0.4)
  assert.equal(g.uniforms.uEstompageOn.value, 1, '`poserEstompage` n’allume pas')
  assert.equal(g.uniforms.uEstompage.value, 0.4, '`poserEstompage` ne pose pas la valeur')
  assert.equal(g._calottes[0].material.transparent, true, 'les calottes restent opaques : leur alpha ne peut rien')
})

test('⑦b `poserEstompage` ÉCRÊTE — une valeur hors [0,1] est un bogue amont', () => {
  const g = globeStub()
  poser(g, 2.5)
  assert.equal(g.uniforms.uEstompage.value, 1)
  poser(g, -3)
  assert.equal(g.uniforms.uEstompage.value, 0)
  poser(g, NaN)
  assert.equal(g.uniforms.uEstompage.value, 0, 'un NaN dans un uniforme éteint la moitié d’un GPU')
})

test('⑦c `retirerEstompage` ÉTEINT, et REMET les calottes opaques', () => {
  const g = globeStub()
  poser(g, 0.4)
  retirer(g)
  assert.equal(g.uniforms.uEstompageOn.value, 0, '`retirerEstompage` n’éteint pas')
  assert.equal(g.uniforms.uEstompage.value, 1, 'la valeur au repos est celle de la Tâche A : le crop seul')
  assert.equal(g._calottes[0].material.transparent, false, 'les calottes restent en liste triée pour rien')
})

test('⑦d `retirerCrop` retire AUSSI l’estompage — un orphelin de plus, sinon', () => {
  const i = GLOBE.indexOf('retirerCrop()')
  assert.ok(i >= 0)
  const corps = GLOBE.slice(i, GLOBE.indexOf('\n  }', i))
  assert.ok(/this\.retirerEstompage\(\)/.test(corps), '`retirerCrop` laisse l’estompage derrière lui')
})

// ══════════ ⑧ LE BRANCHEMENT DANS `main.js`, VÉRIFIÉ AU TEXTE ══════════════

test('⑧a `main.js` pilote l’estompage sur `altitudeCadrageM()` — R1, pas une fraction d’écran', () => {
  const i = MAIN.indexOf('function majEstompage()')
  assert.ok(i >= 0, '`main.js` ne porte pas `majEstompage`')
  const corps = MAIN.slice(i, MAIN.indexOf('\n}', i))
  assert.ok(/veilleEstompage\.maj\(altitudeCadrageM\(\)\)/.test(corps), 'l’estompage ne lit pas `altitudeCadrageM()`')
  // la MÊME garde que `majSeuilSocle` : pendant un cran, `largeurBlocM()` est
  // désaccordée de la caméra et l'altitude rendue vaut la MOITIÉ de la vraie.
  assert.ok(/modes\?\.busy \|\| !\(largeurBlocM\(\) > 0\)/.test(corps), 'l’estompage décide pendant un cran')
  assert.ok(/if \(!frontiereActive\) return/.test(corps), 'l’estompage n’est pas derrière son drapeau')
})

test('⑧b `majEstompage` est appelée dans la boucle, AVANT la passe de fond', () => {
  const iSeuil = MAIN.indexOf('\n  majSeuilSocle()')
  const iEst = MAIN.indexOf('\n  majEstompage()')
  const iCam = MAIN.indexOf('\n  majCameraFond()')
  assert.ok(iSeuil > 0 && iEst > 0 && iCam > 0, 'un des trois appels manque à la boucle')
  assert.ok(iSeuil < iEst, '`majEstompage` doit suivre `majSeuilSocle`')
  assert.ok(iEst < iCam, '`majEstompage` doit précéder `majCameraFond`')
})

test('⑧c le MODE est poussé à la veille, comme il l’est au seuil du socle', () => {
  assert.ok(/veilleEstompage\.poserMode\(v\)/.test(MAIN), 'le mode n’atteint pas la veille de l’estompage')
})
