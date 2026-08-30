// LA PLANÈTE NE DOIT PLUS JAMAIS ÊTRE NUE — règle D15, Tâche R6
// (`.superpowers/sdd/2026-08-22-globe-studio/regle-D15.md`).
//
// ══════════ CE QUE CE FICHIER VÉRIFIE, ET CE QU'IL NE PEUT PAS ══════════════
//
// Même protocole que `crop-eclairage` et `crop-naturel`, dont il reprend les
// six points :
//   ① LA LOI vit dans un module PUR (`monde/planete-eclairee.js`) et se vérifie
//      sous node, point par point ;
//   ② LE TEXTE GLSL est **TRADUIT ET EXÉCUTÉ**, jamais cherché par son nom —
//      la Tâche K ter a trouvé une assertion verte parce qu'elle lisait une
//      formule DANS UN COMMENTAIRE ;
//   ③ **L'UNICITÉ DE L'ÉCRITURE** est elle-même une assertion ;
//   ④ le BRANCHEMENT, qui est la faiblesse récurrente de ce chantier — un
//      drapeau posé que personne ne lit ne protège rien et n'allume rien ;
//   ⑤ **L'ALLER-RETOUR BIT À BIT** : drapeau baissé, la production doit être
//      rigoureusement inchangée, y compris après une vie de crop ;
//   ⑥ ⚡ **ET LE DÉPARTAGE DE D15 EST LUI-MÊME UNE ASSERTION.** D15 range quatre
//      postes du côté « peut devenir global » ; la lecture du nuanceur n'en
//      garde que deux. Ce fichier verrouille la lecture corrigée en L'ÉVALUANT
//      sur le texte du nuanceur, pas en croyant le tableau sur parole.
//
// ⚠️ **CE QUI RESTE HORS DE PORTÉE** : que le GPU exécute ce texte, et que
// l'image obtenue ressemble à ce qu'Adrien a filmé. Seul l'écran le dit — c'est
// `rapport-R6.md` et les relevés de `.banc/R6/`, pas ce fichier.

import test from 'node:test'
import assert from 'node:assert/strict'
import { readFileSync } from 'node:fs'

import {
  MONDE_NU,
  MONDE_ECLAIRE,
  styleMonde,
  POSTES_MONDE,
  postesGlobalisables,
  RELIEF_MONDE,
  RELIEF_MONDE_NUL,
  ombrageRelief,
  lampeRelief,
  GLSL_RELIEF_MONDE,
} from '../src/monde/planete-eclairee.js'
import { RAMPE_MONDE } from '../src/monde/rampe-crop.js'
import { HABILLAGE_MONDE } from '../src/monde/habillage-crop.js'

// ⚠️ **`new Globe()` NE TIENT PAS SOUS NODE SANS CE POSTICHE** : `rebuildRamp`
// appelle `document.createElement('canvas')` au constructeur. C'est le patron de
// `test/crop-eclairage.test.js` et de `test/loi-texture-monde.test.js`.
globalThis.document = {
  createElement: () => ({
    width: 0,
    height: 0,
    getContext: () => ({
      createLinearGradient: () => ({ addColorStop() {} }),
      fillRect() {},
      set fillStyle(_v) {},
    }),
  }),
}
const { Globe } = await import('../src/globe.js')

const GLOBE_SRC = readFileSync(new URL('../src/globe.js', import.meta.url), 'utf8')
const MAIN_SRC = readFileSync(new URL('../src/main.js', import.meta.url), 'utf8')
const FLAGS_SRC = readFileSync(new URL('../src/flags.js', import.meta.url), 'utf8')
const MODULE_SRC = readFileSync(new URL('../src/monde/planete-eclairee.js', import.meta.url), 'utf8')
const FRAG_GLOBE = GLOBE_SRC.slice(
  GLOBE_SRC.indexOf('const FRAG ='),
  GLOBE_SRC.indexOf('\nconst ', GLOBE_SRC.indexOf('const FRAG =') + 10)
)
/** Le même fragment, SANS SES COMMENTAIRES — un commentaire n'est pas du code. */
const FRAG_NU = FRAG_GLOBE.replace(/\/\/[^\n]*/g, '')
const GLOBE_NU = GLOBE_SRC.replace(/\/\/[^\n]*/g, '')
const MAIN_NU = MAIN_SRC.replace(/\/\/[^\n]*/g, '')

// ══════════ L'OUTILLAGE — TRADUIRE LE GLSL, PUIS L'EXÉCUTER ════════════════
//
// ⚠️ **ON TRADUIT LE TEXTE LIVRÉ, ON NE LE RÉÉCRIT PAS.** Une transcription à la
// main serait une seconde écriture de la loi — exactement ce que ce chantier
// paie depuis le début. Ici le GLSL est converti mécaniquement en JavaScript et
// exécuté ; s'il change, le test change avec lui ou il rougit.

const V3 = (x, y, z) => ({ x, y, z })
const v3 = {
  mul: (a, k) => V3(a.x * k, a.y * k, a.z * k),
  add: (a, b) => V3(a.x + b.x, a.y + b.y, a.z + b.z),
  dot: (a, b) => a.x * b.x + a.y * b.y + a.z * b.z,
  norm: (a) => {
    const n = Math.hypot(a.x, a.y, a.z)
    return V3(a.x / n, a.y / n, a.z / n)
  },
}

/**
 * Traduit `lampeReliefMonde` et `ombrageReliefMonde` du texte GLSL livré, puis
 * les rend exécutables. Toute divergence entre le module et le nuanceur remonte
 * ici — c'est le point ② du protocole.
 */
function traduireGlsl(src) {
  const corps = (nom) => {
    const i = src.indexOf(nom + '(')
    assert.ok(i >= 0, `${nom} absent du GLSL livré`)
    const ouvre = src.indexOf('{', i)
    let p = 0, j = ouvre
    for (; j < src.length; j++) {
      if (src[j] === '{') p++
      else if (src[j] === '}' && --p === 0) break
    }
    return src.slice(ouvre + 1, j)
  }
  const js = (t) => t
    .replace(/\bfloat\b|\bvec3\b/g, 'let')
    .replace(/\bcos\(/g, 'Math.cos(')
    .replace(/\bsin\(/g, 'Math.sin(')
    .replace(/\bmax\(/g, 'Math.max(')
    .replace(/\bnormalize\(/g, 'v3.norm(')
    .replace(/\bclamp\(/g, 'CLAMP(')
    .replace(/\bdot\(/g, 'v3.dot(')

  const CLAMP = (x, a, b) => Math.min(Math.max(x, a), b)

  // ⚠️ **LA COMBINAISON LINÉAIRE EST DÉCOUPÉE, PAS DEVINÉE PAR UNE EXPRESSION
  // RÉGULIÈRE.** `est * (ce * sin(azRad)) + nord * …` porte des parenthèses
  // imbriquées : une regex `[^)]*` s'arrête à la PREMIÈRE fermante et rend une
  // lampe fausse — silencieusement. Première version de ce fichier : `NaN` aux
  // 504 points du balayage. On découpe donc aux parenthèses ÉQUILIBRÉES.
  const decouper = (expr, sep) => {
    const bouts = []
    let p = 0, dernier = 0
    for (let i = 0; i < expr.length; i++) {
      const c = expr[i]
      if (c === '(') p++
      else if (c === ')') p--
      else if (c === sep && p === 0) { bouts.push(expr.slice(dernier, i)); dernier = i + 1 }
    }
    bouts.push(expr.slice(dernier))
    return bouts.map((b) => b.trim())
  }
  const combi = (expr) => decouper(expr, '+')
    .map((terme) => {
      const f = decouper(terme, '*')
      assert.equal(f.length, 2, `terme non reconnu dans la lampe : ${terme}`)
      return `v3.mul(${f[0]}, ${f[1]})`
    })
    .reduce((a, b) => `v3.add(${a}, ${b})`)

  const cLampe = corps('lampeReliefMonde')
  const lignes = js(cLampe).trim().split('\n').map((l) => l.trim()).filter(Boolean)
  assert.equal(lignes.length, 2, 'lampeReliefMonde a changé de forme — relis-la')
  const interieur = lignes[1].slice(lignes[1].indexOf('v3.norm(') + 8, lignes[1].lastIndexOf(')'))
  const lampe = new Function('est', 'nord', 'haut', 'azRad', 'elRad', 'v3', `
    ${lignes[0]}
    return v3.norm(${combi(interieur)})
  `)

  const cOmbre = corps('ombrageReliefMonde')
  const ombre = new Function('n', 'haut', 'L', 'gain', 'v3', 'CLAMP', js(cOmbre))
  return {
    lampe: (est, nord, haut, az, el) => lampe(est, nord, haut, az, el, v3),
    ombre: (n, haut, L, gain) => ombre(n, haut, L, gain, v3, CLAMP),
  }
}
const GLSL = traduireGlsl(GLSL_RELIEF_MONDE)

const EST = V3(1, 0, 0)
const NORD = V3(0, 0, 1)
const HAUT = V3(0, 1, 0)

// ══════════════════════════ ① LA LOI, SOUS NODE ═════════════════════════════

test('① l’ombrage rend EXACTEMENT 1 sur sol plat, quel que soit le gain', () => {
  // ⚡ C'est la propriété qui rend la couture avec le bloc invisible ET qui rend
  // le drapeau baissé vérifiable : là où la normale fine vaut la sphère, la
  // planète ne change ni de luminosité ni de teinte.
  for (const gain of [0, 0.1, 0.9, 2, 10]) {
    for (const nduPlat of [0, 0.25, 0.5, 0.70710678, 1]) {
      assert.equal(ombrageRelief(nduPlat, nduPlat, gain), 1)
    }
  }
})

test('① gain nul ⇒ 1 partout, y compris sur une pente extrême', () => {
  for (const ndu of [0, 0.3, 1]) {
    assert.equal(ombrageRelief(ndu, 0.7071, RELIEF_MONDE_NUL), 1)
  }
  assert.equal(RELIEF_MONDE_NUL, 0)
})

test('① l’ombrage est monotone en n·L, et jamais négatif', () => {
  const plat = 0.7071, g = RELIEF_MONDE.gain
  let prec = -Infinity
  for (let ndu = 0; ndu <= 1.0001; ndu += 0.05) {
    const v = ombrageRelief(ndu, plat, g)
    assert.ok(v >= prec, 'la loi doit croître avec n·L')
    assert.ok(v >= 0, 'une couleur ne se multiplie pas par un négatif')
    prec = v
  }
  // un gain assez grand pousserait 1 + g·(0 − plat) sous zéro : la borne mord.
  assert.equal(ombrageRelief(0, 1, 100), 0)
})

test('① la lampe est une direction UNITAIRE, et son azimut est celui d’une boussole', () => {
  const l = lampeRelief(RELIEF_MONDE.azimutDeg, RELIEF_MONDE.elevationDeg)
  assert.ok(Math.abs(Math.hypot(l.est, l.nord, l.haut) - 1) < 1e-12)
  // 315° = nord-ouest : vers le NORD (+) et vers l'OUEST (est négatif).
  assert.ok(l.nord > 0, 'la lampe du nord-ouest regarde vers le nord')
  assert.ok(l.est < 0, 'la lampe du nord-ouest regarde vers l’ouest')
  // 45° d'élévation : la composante verticale vaut sin 45°.
  assert.ok(Math.abs(l.haut - Math.SQRT1_2) < 1e-12)
  // Le nord franc et l'est franc, pour que la convention ne puisse pas glisser.
  const n = lampeRelief(0, 0)
  assert.ok(Math.abs(n.nord - 1) < 1e-12 && Math.abs(n.est) < 1e-12)
  const e = lampeRelief(90, 0)
  assert.ok(Math.abs(e.est - 1) < 1e-12 && Math.abs(e.nord) < 1e-12)
})

// ══════════ ② LE GLSL LIVRÉ, TRADUIT ET EXÉCUTÉ CONTRE LE MODULE ═══════════

test('② le GLSL livré rend la MÊME lampe que le module, sur 72 azimuts × 7 élévations', () => {
  for (let az = 0; az < 360; az += 5) {
    for (const el of [0, 10, 25, 45, 60, 80, 90]) {
      const attendu = lampeRelief(az, el)
      const obtenu = GLSL.lampe(EST, NORD, HAUT, (az * Math.PI) / 180, (el * Math.PI) / 180)
      assert.ok(Math.abs(obtenu.x - attendu.est) < 1e-12, `est az=${az} el=${el}`)
      assert.ok(Math.abs(obtenu.z - attendu.nord) < 1e-12, `nord az=${az} el=${el}`)
      assert.ok(Math.abs(obtenu.y - attendu.haut) < 1e-12, `haut az=${az} el=${el}`)
    }
  }
})

test('② le GLSL livré rend le MÊME ombrage que le module, bornes comprises', () => {
  const L = GLSL.lampe(EST, NORD, HAUT, (315 * Math.PI) / 180, (45 * Math.PI) / 180)
  const nduPlat = Math.min(Math.max(v3.dot(HAUT, L), 0), 1)
  for (const gain of [0, 0.45, 0.9, 3]) {
    for (let a = -1; a <= 1.0001; a += 0.1) {
      // une normale quelconque, obtenue en penchant la verticale vers l'est
      const n = v3.norm(V3(a, 1, 0.3))
      const ndu = Math.min(Math.max(v3.dot(n, L), 0), 1)
      assert.equal(GLSL.ombre(n, HAUT, L, gain), ombrageRelief(ndu, nduPlat, gain))
    }
  }
})

test('② le GLSL livré est NEUTRE quand la normale est la verticale', () => {
  const L = GLSL.lampe(EST, NORD, HAUT, (315 * Math.PI) / 180, (45 * Math.PI) / 180)
  for (const gain of [0, 0.9, 5]) assert.equal(GLSL.ombre(HAUT, HAUT, L, gain), 1)
})

// ═════════════════ ③ UNE SEULE ÉCRITURE DE LA LOI ═══════════════════════════

test('③ globe.js n’écrit pas sa propre lampe ni son propre ombrage', () => {
  // Le fragment doit APPELER les deux fonctions ; leur CORPS ne doit vivre que
  // dans le module, injecté par `${'$'}{GLSL_RELIEF_MONDE}`.
  assert.ok(FRAG_NU.includes('lampeReliefMonde('), 'le fragment doit appeler la lampe')
  assert.ok(FRAG_NU.includes('ombrageReliefMonde('), 'le fragment doit appeler l’ombrage')
  assert.ok(GLOBE_NU.includes('${GLSL_RELIEF_MONDE}'), 'le module doit être INJECTÉ, pas recopié')
  // ⚠️ La signature du corps, pas son nom : `nduPlat` n'existe que dans la loi.
  assert.ok(!GLOBE_NU.includes('nduPlat'), 'une SECONDE écriture de l’ombrage vit dans globe.js')
  // Et les angles sont convertis côté JS, jamais dans le nuanceur.
  assert.ok(!FRAG_NU.includes('radians(uReliefMondeAz'), 'le nuanceur ne convertit pas d’unité')
})

test('③ l’état de repos du monde n’est écrit qu’UNE fois', () => {
  // `MONDE_NU` / `MONDE_ECLAIRE` / `styleMonde` sont les seules sources ; aucun
  // des trois sites de `globe.js` ne doit reposer un littéral.
  const sites = [
    /uMerZeroSousEau: \{ value: styleMonde\(this\.planeteEclairee\)\.merZeroSousEau \}/,
    /uNormaleFineOn: \{ value: styleMonde\(this\.planeteEclairee\)\.normaleFine \}/,
  ]
  for (const r of sites) assert.match(GLOBE_SRC, r, `l’état de repos est écrit en dur : ${r}`)
})

// ═══════════ ④ LE BRANCHEMENT — LA FAIBLESSE RÉCURRENTE DU CHANTIER ═════════

test('④ le drapeau existe, il est LEVÉ, et il exige `terre unique` — ÉVALUÉ', async () => {
  // ⛔ **CE QUI A CRÉÉ CE TEST.** Sa version précédente ne faisait que du
  // `assert.match` sur le TEXTE de `flags.js`, sous un commentaire qui annonçait
  // « La garde, ÉVALUÉE ». La campagne de mutation de la relecture a montré que
  // `planeteEclaireeActive()` **n'était jamais exécutée** : quatre mutations
  // survivaient, dont le passage du DÉFAUT DE PRODUCTION à `true`.
  // ⚠️ Le dépôt portait pourtant le patron exact trente lignes plus loin —
  // `crop-branche` ⑦ bis — et il est recopié ici, échappatoire comprise.
  //
  // ⛔ **ET CE QUI L'A RÉÉCRIT LE 2026-08-30 : LE DÉFAUT A BASCULÉ.** Adrien a
  // demandé le mode sphère au démarrage, les sept drapeaux sont levés. Les
  // gardes de dépendance ci-dessous se testaient par l'ABSENCE de paramètre
  // (`?planete=eclairee` seul, sans `?terre=unique`, sans `?frontiere=1`) — et
  // l'absence signifie maintenant l'INVERSE. Laissées telles quelles, elles
  // seraient restées VERTES POUR LA MAUVAISE RAISON : des décorations. Elles
  // sont réécrites contre des paramètres **explicitement éteints**.
  const { planeteEclaireeActive, FLAGS } = await import('../src/flags.js')
  const avant = globalThis.location
  const defaut = FLAGS.planeteEclairee
  const q = (s) => { globalThis.location = { search: s } }
  try {
    // ① LE DÉFAUT DE PRODUCTION EST ON — et ça se lit sur la VALEUR RENDUE.
    q('?terre=unique&frontiere=1')
    assert.equal(planeteEclaireeActive(), true, 'le défaut de production allume la planète')
    // ⚠️ **ET SANS AUCUN PARAMÈTRE AUSSI** : c'est ça, littéralement, « commencer
    //    en mode sphère au chargement ». C'est la seule ligne de ce fichier qui
    //    décrive ce qu'Adrien voit en ouvrant shibumap.com.
    q('')
    assert.equal(planeteEclaireeActive(), true, 'adresse nue : la planète est éclairée au chargement')

    // ② `?planete=nue` (et `=0`) COUPE — c'est la branche qui mord aujourd'hui,
    //    et c'est le levier de retour à la production d'avant.
    q('?terre=unique&frontiere=1&planete=nue')
    assert.equal(planeteEclaireeActive(), false, '`?planete=nue` doit COUPER')
    q('?terre=unique&frontiere=1&planete=0')
    assert.equal(planeteEclaireeActive(), false, '`?planete=0` aussi')

    // ③ ⚠️ **LES DEUX GARDES, ÉVALUÉES CONTRE UN PARAMÈTRE ÉTEINT.** Sans
    //    `poserLoiMonde`, `uMppFacteur` vaut 0 et le pas du gradient retombe au
    //    TEXEL — le scintillement que la Tâche K a fermé.
    q('?planete=eclairee&frontiere=1&terre=deux')
    assert.equal(planeteEclaireeActive(), false, 'sans `terre unique`, rien ne s’allume')
    q('?planete=eclairee&frontiere=1&terre=0')
    assert.equal(planeteEclaireeActive(), false, 'et `?terre=0` la coupe pareillement')
    q('?planete=eclairee&terre=unique&frontiere=0')
    assert.equal(planeteEclaireeActive(), false, 'sans la frontière de rendu non plus')
    q('?planete=eclairee&terre=unique&frontiere=crans')
    assert.equal(planeteEclaireeActive(), false, 'et `?frontiere=crans` la coupe pareillement')

    // ④ ⚠️ **L'ÉCHAPPATOIRE NE SE TESTE QUE CONTRE LE DÉFAUT CONTRAIRE**, et
    //    c'est la leçon que `crop-branche` ⑦ bis a déjà payée sur ce chantier.
    //    ⛔ Le basculement du défaut l'a RETOURNÉE : hier c'était `?planete=nue`
    //    qui ne mordait pas (défaut faux) ; aujourd'hui c'est
    //    `?planete=eclairee` qui retomberait sur un défaut vrai. Chaque branche
    //    est donc exercée avec le drapeau forcé à l'inverse.
    FLAGS.planeteEclairee = false
    q('?terre=unique&frontiere=1')
    assert.equal(planeteEclaireeActive(), false, 'défaut à false : `terre unique` ne suffit pas')
    q('?terre=unique&frontiere=1&planete=eclairee')
    assert.equal(planeteEclaireeActive(), true, '`?planete=eclairee` doit ALLUMER un défaut éteint')
    q('?terre=unique&frontiere=1&planete=1')
    assert.equal(planeteEclaireeActive(), true, '`?planete=1` aussi')

    FLAGS.planeteEclairee = true
    q('?terre=unique&frontiere=1')
    assert.equal(planeteEclaireeActive(), true, 'défaut à true : `terre unique` suffit')
    // et la garde `terre unique` tient même défaut levé
    q('?frontiere=1&terre=deux')
    assert.equal(planeteEclaireeActive(), false, 'la garde `terre unique` prime sur le défaut')
  } finally {
    FLAGS.planeteEclairee = defaut
    if (avant === undefined) delete globalThis.location
    else globalThis.location = avant
  }
})

test('④ main.js LIT le drapeau et le passe au globe', () => {
  assert.ok(MAIN_NU.includes('planeteEclaireeActive'), 'personne ne lit le drapeau')
  assert.ok(
    /new Globe\(\{[^}]*planeteEclairee: planeteEclaireeBranchee/.test(MAIN_NU),
    'le globe ne reçoit pas le drapeau'
  )
  // ⚠️ **LU UNE SEULE FOIS**, même discipline que `terreUniqueBranchee` : deux
  // lectures du même drapeau finissent par diverger.
  assert.equal((MAIN_NU.match(/planeteEclaireeActive\(\)/g) || []).length, 1)
})

test('④ le globe allumé porte les DEUX postes, sans crop et sans habillage', () => {
  const g = new Globe({ planeteEclairee: true })
  assert.equal(g.uniforms.uNormaleFineOn.value, 1)
  assert.equal(g.uniforms.uMerZeroSousEau.value, 1)
  assert.equal(g.uniforms.uReliefMondeGain.value, RELIEF_MONDE.gain)
  // ⚠️ **ET RIEN D'AUTRE NE S'ALLUME.** D15 ne dit pas « allumer les sept ».
  assert.equal(g.uniforms.uCropOn.value, 0)
  assert.equal(g.uniforms.uHabOn.value, 0)
  assert.equal(g.uniforms.uAnalysisOn.value, 0)
  assert.equal(g.uniforms.uRampCropOn.value, 0)
  assert.equal(g.uniforms.uEclairageOn.value, 0)
})

test('④ les angles arrivent au nuanceur EN RADIANS, convertis côté JS', () => {
  const g = new Globe({ planeteEclairee: true })
  assert.equal(g.uniforms.uReliefMondeAz.value, (RELIEF_MONDE.azimutDeg * Math.PI) / 180)
  assert.equal(g.uniforms.uReliefMondeEl.value, (RELIEF_MONDE.elevationDeg * Math.PI) / 180)
})

// ══════ ⑤ L'ALLER-RETOUR BIT À BIT — DRAPEAU BAISSÉ, RIEN NE BOUGE ══════════

test('⑤ drapeau baissé, les trois uniformes sont ceux du dépôt', () => {
  const g = new Globe()
  assert.equal(g.uniforms.uNormaleFineOn.value, MONDE_NU.normaleFine)
  assert.equal(g.uniforms.uMerZeroSousEau.value, MONDE_NU.merZeroSousEau)
  assert.equal(g.uniforms.uReliefMondeGain.value, RELIEF_MONDE_NUL)
  assert.equal(styleMonde(false), MONDE_NU)
  assert.equal(styleMonde(true), MONDE_ECLAIRE)
})

test('⑤ drapeau baissé, une vie de crop rend EXACTEMENT l’état d’avant', () => {
  // C'est le défaut C-3 de la Tâche C : `retirer…` qui ne retire pas tout.
  const g = new Globe()
  const avant = [g.uniforms.uNormaleFineOn.value, g.uniforms.uMerZeroSousEau.value]
  g.uniforms.uNormaleFineOn.value = 1
  g.uniforms.uMerZeroSousEau.value = 1
  g.retirerHabillage()
  g.retirerRampe()
  assert.deepEqual(
    [g.uniforms.uNormaleFineOn.value, g.uniforms.uMerZeroSousEau.value],
    avant
  )
  assert.equal(g.uniforms.uNormaleFineOn.value, HABILLAGE_MONDE.normaleFine ? 1 : 0)
})

test('⑤ drapeau LEVÉ, la mort du crop ne redéshabille PAS la planète', () => {
  // ⚡ **C'EST ICI QUE LE DÉFAUT SE REFERMAIT.** `retirerHabillage` /
  // `retirerRampe` sont appelés à chaque remontée au-dessus de 32 274 m,
  // c'est-à-dire au moment précis où on regarde la planète.
  const g = new Globe({ planeteEclairee: true })
  g.retirerHabillage()
  g.retirerRampe()
  assert.equal(g.uniforms.uNormaleFineOn.value, MONDE_ECLAIRE.normaleFine)
  assert.equal(g.uniforms.uMerZeroSousEau.value, MONDE_ECLAIRE.merZeroSousEau)
})

test('⑤ drapeau LEVÉ, un habillage SANS normale fine ne l’éteint pas', () => {
  // Une palette, un gabarit : `poserHabillage` est rejoué par la veille à
  // chaque image. Sans le `||`, le premier rejeu déshabillait tout.
  const g = new Globe({ planeteEclairee: true })
  g.poserHabillage({ normaleFine: false })
  assert.equal(g.uniforms.uNormaleFineOn.value, 1)
})

// ══════════ ⑥ ⚡ LE DÉPARTAGE DE D15, ÉVALUÉ SUR LE NUANCEUR ════════════════

test('⑥ les postes déclarés globaux sont exactement les deux qu’on allume', () => {
  assert.deepEqual(postesGlobalisables(), ['uMerZeroSousEau', 'uNormaleFineOn'])
})

test('⑥ uEclairageOn hors crop est un NO-OP, et c’est le nuanceur qui le dit', () => {
  // ⛔ D15 demande « l'éclairage global ». Mesuré sur le texte : `partBloc`
  // vaut `dedansCrop`, `dedansCrop` est initialisé à 0 et n'est ÉCRIT que dans
  // le bloc gardé par `uCropOn`. Sans crop, l'allumer ne change rien.
  assert.match(FRAG_NU, /float dedansCrop = 0\.0;/)
  assert.match(FRAG_NU, /float partBloc = uEclairageOn > 0\.5 \? dedansCrop : 0\.0;/)
  const ecritures = FRAG_NU.match(/^\s*dedansCrop = /gm) || []
  assert.equal(ecritures.length, 1, 'dedansCrop est écrit ailleurs — relis la garde')
  // et cette unique écriture est DANS le bloc `if (uCropOn > 0.5) {`
  const iGarde = FRAG_NU.indexOf('if (uCropOn > 0.5) {')
  const iEcrit = FRAG_NU.search(/^\s*dedansCrop = /m)
  const iFin = FRAG_NU.indexOf('float h = hauteurFond(')
  assert.ok(iGarde >= 0 && iEcrit > iGarde && iEcrit < iFin)
  assert.equal(POSTES_MONDE.uEclairageOn.global, false)
})

test('⑥ les DEUX AUTRES lecteurs de `uEclairageOn` n’existent pas sans crop', async () => {
  // ⛔ **m1 DE LA RELECTURE.** Le rapport concluait « l'allumer globalement ne
  // changerait pas un pixel » **sans vérifier que l'uniforme est PARTAGÉ**. Il
  // l'est, par deux autres nuanceurs : la mer du crop (il choisit `uSoleilDir`
  // au lieu de `uSunDir`) et les parois du crop (elles choisissent `colBloc` au
  // lieu de `colPlanete`). La conclusion tient — mais **parce que ni l'un ni
  // l'autre n'EXISTE tant qu'aucun crop n'est posé**, et c'est ça qu'on vérifie.
  assert.ok(GLOBE_NU.includes('uEclairageOn > 0.5 ? uSoleilDir : uSunDir'),
    'la mer du crop ne lit plus uEclairageOn — relis la démonstration')
  assert.ok(GLOBE_NU.includes('uEclairageOn > 0.5 ? colBloc : colPlanete'),
    'les parois du crop ne lisent plus uEclairageOn — relis la démonstration')
  // ⚡ ET LA DÉMONSTRATION, ELLE, EST EXÉCUTÉE : sans crop, les deux refusent.
  const g = new Globe({ planeteEclairee: true })
  assert.equal(g._crop, null, 'un globe neuf ne porte pas de crop')
  assert.equal(g._mer, null, 'un globe neuf ne porte pas de mer')
  assert.equal(g.construireParoisCrop(), null, 'les parois doivent refuser sans crop')
  assert.equal(await g.poserMer(), null, 'la mer doit refuser sans crop')
})

test('⑥ le peigne des crêtes LIT l’analyse cuite, il ne dérive pas la tuile', () => {
  // ⛔ D15 écrit que `uTexShade` « se calcule depuis cette même texture de
  // hauteur ». Le nuanceur dit le contraire : les deux canaux viennent de
  // `uAnalysis`, cuite par `terrain-analysis.js` sur le MNT DU CROP.
  assert.match(FRAG_NU, /anl = mix\(vec4\(0\.5\), texture2D\(uAnalysis,/)
  assert.match(FRAG_NU, /col = natPeigne\(col, anl\.r, anl\.g, uTexShade\);/)
  assert.equal(POSTES_MONDE.uAnalysisOn.global, false)
})

test('⑥ la rampe 2D indexe son axe Y sur l’analyse, donc elle non plus', () => {
  assert.match(FRAG_NU, /natHumiditeY\(anl\.b, anl\.a,/)
  assert.match(FRAG_NU, /col = texture2D\(uRampCrop, vec2\(rampT, wetY\)\)\.rgb;/)
  assert.equal(POSTES_MONDE.uRampCropOn.global, false)
})

test('⑥ le zéro de la mer est un NO-OP tant que la rampe NAUTIQUE dort', () => {
  // ⚡ **CONTREDIT L'ÉTAPE 3 DU BRIEF, ET C'EST ARITHMÉTIQUE.** À h = 0 les deux
  // branches de `float t` rendent la MÊME valeur, donc le même texel de rampe :
  //   terre : 0.35 + 0.65 × clamp((0 − terreBas) / (terreHaut − terreBas))
  //   mer   : 0.35 × (1 − clamp(0 / profondeur))
  // Avec `RAMPE_MONDE.terreBas = 0`, les deux valent EXACTEMENT 0,35. Le
  // correctif ne mord que là où `uMerRampeOn` est allumé — c'est-à-dire dans le
  // crop, et nulle part ailleurs.
  assert.equal(RAMPE_MONDE.terreBas, 0)
  const tTerre = 0.35 + 0.65 * Math.min(Math.max((0 - RAMPE_MONDE.terreBas) / Math.max(RAMPE_MONDE.terreHaut - RAMPE_MONDE.terreBas, RAMPE_MONDE.plancherM), 0), 1)
  const tMer = 0.35 * (1 - Math.min(Math.max(-0 / Math.max(RAMPE_MONDE.profondeur, RAMPE_MONDE.plancherM), 0), 1))
  assert.ok(Object.is(tTerre, tMer), 'à h = 0 les deux branches doivent rendre le même t')
  // et la rampe nautique, elle, est bien gardée par un interrupteur de crop
  assert.match(FRAG_NU, /if \(uMerRampeOn > 0\.5 && sousEau\) \{/)
})

test('⑥ le module DIT où D15 se trompe, plutôt que de le taire', () => {
  // Un départage corrigé qui ne serait écrit nulle part serait perdu au premier
  // relecteur qui rouvrirait D15. Le texte est donc une assertion.
  assert.match(MODULE_SRC, /D15 SE TROMPE/)
  for (const n of ['uTexShade', 'uRampCropOn', 'uEclairageOn']) {
    assert.ok(MODULE_SRC.includes(n), `le départage ne parle pas de ${n}`)
  }
})

// ══════ ⑦ ⚡ LE GAIN MORD — LA GARDE ET LE CORPS DU NUANCEUR, EXÉCUTÉS ══════
//
// ⛔ **CE QUI A CRÉÉ CETTE SECTION.** La relecture de R6 a mené la campagne de
// mutation que le premier tour n'avait PAS menée, et elle a trouvé que le poste
// qui porte tout l'effet visible pouvait être ramené à un no-op strict **sans
// qu'un seul des 4 219 tests rougisse** :
//   · `RELIEF_MONDE.gain: 0.9 → 0` → suite verte ;
//   · la garde `if (uReliefMondeGain > 0.0)` changée en `> 1000.0` → verte ;
//   · `ombrageReliefMonde(…, uReliefMondeGain)` appelé avec `0.0` → verte.
// La fonctionnalité était livrable ÉTEINTE, et le drapeau levé n'aurait rien
// prouvé.
//
// ⚠️ **UNE ASSERTION QUI LIT LE TEXTE NE LES FERME PAS.** `assert.match` sur
// `> 0.0` reste vert quand le gain tombe à zéro ailleurs, et un `return` muet
// rend un test vert indistinguable d'un test qui a lu. Ce qui se vérifie ici est
// donc **le comportement** : on extrait du fragment LIVRÉ sa garde et son corps,
// on les exécute avec les uniformes d'un `new Globe()` RÉEL et la loi du module
// injecté, et on exige que le facteur rendu soit **strictement différent de 1**
// sur une pente. Les trois mutations le ramènent à 1 — donc les trois rougissent.

/** Découpe une paire de délimiteurs ÉQUILIBRÉE à partir de l'index `i`. */
function bloc(src, i, ouvrant, fermant) {
  const a = src.indexOf(ouvrant, i)
  assert.ok(a >= 0, `${ouvrant} introuvable`)
  let p = 0
  for (let j = a; j < src.length; j++) {
    if (src[j] === ouvrant) p++
    else if (src[j] === fermant && --p === 0) return { texte: src.slice(a + 1, j), fin: j }
  }
  throw new Error(`${fermant} manquant`)
}

/**
 * Extrait du fragment livré : la valeur de repos d'`ombreRelief`, la condition
 * de la garde, et le corps gardé — puis rend le tout EXÉCUTABLE.
 * ⚠️ On ne réécrit rien : si le nuanceur change, ceci change avec lui ou rougit.
 */
function extraireOmbrageMonde(frag) {
  const mInit = /float ombreRelief = ([^;]+);/.exec(frag)
  assert.ok(mInit, 'la valeur de repos d’ombreRelief a disparu du fragment')
  const i = frag.indexOf('if (uReliefMondeGain')
  assert.ok(i >= 0, 'la garde du gain a disparu du fragment')
  const cond = bloc(frag, i, '(', ')')
  const corps = bloc(frag, cond.fin, '{', '}')
  const js = corps.texte.replace(/\bvec3\b|\bfloat\b/g, 'let')
  const f = new Function(
    'est', 'nord', 'haut', 'nMonde',
    'uReliefMondeGain', 'uReliefMondeAz', 'uReliefMondeEl',
    'lampeReliefMonde', 'ombrageReliefMonde',
    `let ombreRelief = ${mInit[1]};
     if (${cond.texte}) {${js}}
     return ombreRelief`
  )
  return (u, n) => f(
    EST, NORD, HAUT, n,
    u.uReliefMondeGain.value, u.uReliefMondeAz.value, u.uReliefMondeEl.value,
    GLSL.lampe, GLSL.ombre
  )
}
const OMBRAGE_FRAG = extraireOmbrageMonde(FRAG_NU)

/** Une normale penchée vers le nord-ouest (vers la lampe) ou vers le sud-est. */
const PENTE_NO = v3.norm(V3(-0.3, 1, 0.3))
const PENTE_SE = v3.norm(V3(0.3, 1, -0.3))

test('⑦ drapeau LEVÉ, le nuanceur livré MODULE vraiment sur une pente', () => {
  // ⚡ **C'EST LE TEST QUI DÉCIDE DE L'EFFET VISIBLE.** Il tient ensemble le
  // gain du module, la garde du fragment et l'argument passé à la loi : que
  // l'un des trois soit neutralisé et le facteur retombe à 1.
  const u = new Globe({ planeteEclairee: true }).uniforms
  const versLaLampe = OMBRAGE_FRAG(u, PENTE_NO)
  const dosALaLampe = OMBRAGE_FRAG(u, PENTE_SE)
  assert.ok(versLaLampe > 1.02, `une pente vers la lampe doit ÉCLAIRCIR (obtenu ${versLaLampe})`)
  assert.ok(dosALaLampe < 0.98, `une pente au dos de la lampe doit ASSOMBRIR (obtenu ${dosALaLampe})`)
  // et l'écart entre les deux versants est ce qu'Adrien appelle « du relief »
  assert.ok(versLaLampe - dosALaLampe > 0.2, 'la modulation est trop faible pour se voir')
})

test('⑦ le gain de production est NON NUL, et c’est lui qui module', () => {
  // ⛔ La mutation `RELIEF_MONDE.gain → 0` passait la suite entière. Ici elle
  // ferme la garde du fragment, donc le facteur retombe à 1 et ceci rougit.
  assert.ok(RELIEF_MONDE.gain > 0, 'un gain nul livre la planète nue sous un drapeau levé')
  const u = new Globe({ planeteEclairee: true }).uniforms
  assert.equal(u.uReliefMondeGain.value, RELIEF_MONDE.gain)
  assert.notEqual(OMBRAGE_FRAG(u, PENTE_NO), 1)
  // la loi du module, à ce gain-là, doit elle aussi sortir de 1 sur une pente
  assert.notEqual(ombrageRelief(1, 0.7071, RELIEF_MONDE.gain), 1)
})

test('⑦ drapeau baissé, le MÊME bloc rend EXACTEMENT 1 — la garde tient', () => {
  // L'autre bord de la même assertion : sans drapeau la garde ne s'ouvre pas et
  // `colPlanete` reste celle du dépôt au bit près.
  const u = new Globe().uniforms
  assert.equal(u.uReliefMondeGain.value, RELIEF_MONDE_NUL)
  for (const n of [PENTE_NO, PENTE_SE, HAUT]) assert.equal(OMBRAGE_FRAG(u, n), 1)
})

test('⑦ la garde s’ouvre AU GAIN, pas à autre chose', () => {
  // Un gain minuscule doit déjà ouvrir la garde (sinon un seuil caché traîne),
  // et un gain nul doit la laisser fermée.
  const u = new Globe({ planeteEclairee: true }).uniforms
  const truque = (g) => ({ ...u, uReliefMondeGain: { value: g } })
  assert.equal(OMBRAGE_FRAG(truque(0), PENTE_NO), 1)
  assert.notEqual(OMBRAGE_FRAG(truque(0.01), PENTE_NO), 1)
  // et le facteur croît avec le gain : la garde ne masque pas une constante
  assert.ok(OMBRAGE_FRAG(truque(0.9), PENTE_NO) > OMBRAGE_FRAG(truque(0.45), PENTE_NO))
})

// ══════════ LE COÛT — CE QUE CE FICHIER PEUT ET NE PEUT PAS DIRE ════════════

test('le coût ne se mesure PAS ici, et le banc existe', () => {
  // ⛔ Une tâche D15 qui ne chronomètre pas est une tâche non finie — mais un
  // test node ne chronomètre pas un nuanceur. Le banc est
  // `scripts/banc-relief-monde.mjs` et ses relevés sont dans `.banc/R6/`.
  // Ce qui se vérifie ici, c'est que le banc n'a pas disparu du dépôt.
  const banc = readFileSync(new URL('../scripts/banc-relief-monde.mjs', import.meta.url), 'utf8')
  assert.match(banc, /readPixels/, 'le point de synchronisation a disparu')
  assert.match(banc, /uReliefMondeGain/, 'le banc ne coupe plus le poste qu’il mesure')
})
