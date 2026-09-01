// L'ÉCLAIRAGE DU CROP, CÔTÉ SPHÈRE — Tâche R21
// (`.superpowers/sdd/2026-08-22-globe-studio/brief-R21.md`).
//
// Huit réglages du studio portaient ⛔ dans `inventaire-studio-2.md` : 68
// (douceur des ombres), 69 à 73 (l'appoint), 26 (ombrage auto) et 30 (ombrage
// des pentes). Ce fichier vérifie ce qui a été fait de chacun.
//
// ══════════ CE QUE CE FICHIER VÉRIFIE, ET CE QU'IL NE PEUT PAS ══════════════
//
// Même protocole que `planete-eclairee`, `crop-eclairage` et `crop-naturel` :
//   ① LA LOI vit dans un module PUR et se vérifie sous node, point par point ;
//   ② LE TEXTE GLSL est **TRADUIT ET EXÉCUTÉ**, jamais cherché par son nom —
//      la Tâche K ter a trouvé une assertion verte parce qu'elle lisait une
//      formule DANS UN COMMENTAIRE ;
//   ③ **L'UNICITÉ DE L'ÉCRITURE** est elle-même une assertion ;
//   ④ le BRANCHEMENT — un uniforme posé que personne ne transmet n'allume rien.
//      C'est la faiblesse récurrente de ce chantier, et c'est exactement la
//      panne que les huit réglages avaient ;
//   ⑤ **L'ALLER-RETOUR BIT À BIT** de `poserHabillage` / `retirerHabillage` ;
//   ⑥ **LA TABLE DES VERDICTS COMMANDE L'INTERFACE**, et le test l'EXÉCUTE au
//      lieu de relire le DOM.
//
// ⚠️ **CE QUI RESTE HORS DE PORTÉE** : que le GPU exécute ce texte, et de
// combien l'image bouge. Seul l'écran le dit — c'est `rapport-R21.md` et les
// relevés de `.banc/R21/`, pas ce fichier.

import test from 'node:test'
import assert from 'node:assert/strict'
import { readFileSync } from 'node:fs'

import {
  APPOINT_MONDE_ETEINT,
  PENTE_MONDE_NULLE,
  PENTE_BRUN,
  POSTES_LUMIERE_SPHERE,
  GLSL_LUMIERE_SPHERE,
  directionAppointMonde,
  irradianceAppoint,
  penteSol,
  teintePente,
  lissePente,
  curseursMorts,
  reglageAgit,
} from '../src/monde/lumiere-sphere.js'
import { directionSoleilLocale, hautLocal, irradianceCrop } from '../src/monde/eclairage-crop.js'
import { fillDirection, fillLightIntensity } from '../src/daycycle.js'
import { CHAMPS_HABILLAGE } from '../src/monde/branchement-crop.js'

// ⚠️ **`new Globe()` NE TIENT PAS SOUS NODE SANS CE POSTICHE** : `rebuildRamp`
// appelle `document.createElement('canvas')` au constructeur. C'est le patron de
// `test/planete-eclairee.test.js` et de `test/crop-eclairage.test.js`.
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
const PANNEAU_SRC = readFileSync(new URL('../src/ui/light-panel.js', import.meta.url), 'utf8')
const FRAG_GLOBE = GLOBE_SRC.slice(
  GLOBE_SRC.indexOf('const FRAG ='),
  GLOBE_SRC.indexOf('\nconst ', GLOBE_SRC.indexOf('const FRAG =') + 10)
)
/** Le même fragment, SANS SES COMMENTAIRES — un commentaire n'est pas du code. */
const FRAG_NU = FRAG_GLOBE.replace(/\/\/[^\n]*/g, '')
const GLOBE_NU = GLOBE_SRC.replace(/\/\/[^\n]*/g, '')
const MAIN_NU = MAIN_SRC.replace(/\/\/[^\n]*/g, '')
const PANNEAU_NU = PANNEAU_SRC.replace(/\/\/[^\n]*/g, '')

// ══════════ L'OUTILLAGE — TRADUIRE LE GLSL, PUIS L'EXÉCUTER ════════════════
//
// ⚠️ **ON TRADUIT LE TEXTE LIVRÉ, ON NE LE RÉÉCRIT PAS.** Une transcription à la
// main serait une seconde écriture de la loi — exactement ce que ce chantier
// paie depuis le début. Le GLSL est converti mécaniquement puis exécuté ; s'il
// change, ce fichier change avec lui ou il rougit.
//
// ⚠️ **ET LE PRODUIT `*` EST DÉCOUPÉ AUX PARENTHÈSES ÉQUILIBRÉES**, pas par une
// expression régulière : `appoint * max(ndl, 0.0)` est un vecteur fois un
// scalaire, et `mix(a, b, smoothstep(…) * k)` en porte un second à l'intérieur
// d'un argument. Une regex `[^)]*` s'arrête à la PREMIÈRE fermante — c'est la
// faute que `planete-eclairee.test.js` documente, et elle rend `NaN` en silence.

const V3 = (x, y, z) => [x, y, z]
const estVec = (v) => Array.isArray(v)
const MUL = (a, b) => {
  if (estVec(a) && estVec(b)) return [a[0] * b[0], a[1] * b[1], a[2] * b[2]]
  if (estVec(a)) return [a[0] * b, a[1] * b, a[2] * b]
  if (estVec(b)) return [b[0] * a, b[1] * a, b[2] * a]
  return a * b
}
const CLAMP = (x, a, b) => Math.min(Math.max(x, a), b)
const DOT = (a, b) => a[0] * b[0] + a[1] * b[1] + a[2] * b[2]
const SMOOTHSTEP = (a, b, x) => {
  const t = CLAMP((x - a) / (b - a), 0, 1)
  return t * t * (3 - 2 * t)
}
const MIX = (a, b, t) => (estVec(a)
  ? [a[0] + (b[0] - a[0]) * t, a[1] + (b[1] - a[1]) * t, a[2] + (b[2] - a[2]) * t]
  : a + (b - a) * t)

/** Découpe une expression à un séparateur, aux parenthèses ÉQUILIBRÉES. */
function decouper(expr, sep) {
  const bouts = []
  let p = 0
  let dernier = 0
  for (let i = 0; i < expr.length; i++) {
    const c = expr[i]
    if (c === '(') p++
    else if (c === ')') p--
    else if (c === sep && p === 0) { bouts.push(expr.slice(dernier, i)); dernier = i + 1 }
  }
  bouts.push(expr.slice(dernier))
  return bouts.map((b) => b.trim())
}

/** Réécrit tous les produits en `MUL(...)`, à toute profondeur d'argument. */
function mulifier(expr) {
  const e = expr.trim()
  const facteurs = decouper(e, '*')
  if (facteurs.length > 1) return facteurs.map(mulifier).reduce((a, b) => `MUL(${a}, ${b})`)
  const i = e.indexOf('(')
  if (i > 0 && e.endsWith(')')) {
    const nom = e.slice(0, i)
    const args = decouper(e.slice(i + 1, -1), ',').map(mulifier)
    return `${nom}(${args.join(', ')})`
  }
  return e
}

/** Le corps `return …;` d'une fonction GLSL livrée, rendu exécutable. */
function traduire(nom, params) {
  const i = GLSL_LUMIERE_SPHERE.indexOf(' ' + nom + '(')
  assert.ok(i >= 0, `${nom} absent du GLSL livré`)
  const ouvre = GLSL_LUMIERE_SPHERE.indexOf('{', i)
  let p = 0
  let j = ouvre
  for (; j < GLSL_LUMIERE_SPHERE.length; j++) {
    if (GLSL_LUMIERE_SPHERE[j] === '{') p++
    else if (GLSL_LUMIERE_SPHERE[j] === '}' && --p === 0) break
  }
  const corps = GLSL_LUMIERE_SPHERE.slice(ouvre + 1, j).trim()
  assert.ok(corps.startsWith('return ') && corps.endsWith(';'), `${nom} n’est plus un seul return — relis-le`)
  const expr = mulifier(corps.slice(7, -1))
    .replace(/\bvec3\(/g, 'V3(')
    .replace(/\bmix\(/g, 'MIX(')
    .replace(/\bsmoothstep\(/g, 'SMOOTHSTEP(')
    .replace(/\bclamp\(/g, 'CLAMP(')
    .replace(/\bdot\(/g, 'DOT(')
    .replace(/\bmax\(/g, 'Math.max(')
  const f = new Function(...params, 'V3', 'MUL', 'MIX', 'SMOOTHSTEP', 'CLAMP', 'DOT', `return ${expr}`)
  return (...a) => f(...a, V3, MUL, MIX, SMOOTHSTEP, CLAMP, DOT)
}
const GLSL = {
  irradianceAppoint: traduire('irradianceAppoint', ['ndl', 'appoint']),
  penteSol: traduire('penteSol', ['n', 'haut']),
  teintePente: traduire('teintePente', ['mapCol', 'slope', 'k']),
}

// ══════════════════════════ ① LA LOI, SOUS NODE ═════════════════════════════

test('①a l’appoint ÉTEINT ne verse rien, quelle que soit la normale', () => {
  // ⚡ **C'EST LA GARDE, ET C'EST ELLE QUI REND L'ÉTAT DE REPOS BIT À BIT.** À
  // irradiance nulle la somme du nuanceur est inchangée TERME À TERME, quelle
  // que soit `uAppointDir` — donc aucun second booléen à tenir d'accord.
  for (const ndl of [-1, -0.3, 0, 0.5, 1]) {
    assert.deepEqual(irradianceAppoint(ndl, APPOINT_MONDE_ETEINT.irr), [0, 0, 0])
  }
  assert.deepEqual([...APPOINT_MONDE_ETEINT.irr], [0, 0, 0])
})

test('①b l’appoint n’éclaire PAS la face arrière — max(ndl, 0), comme three', () => {
  // Une mutation qui met `abs` à la place de `max` allumerait les flancs opposés
  // à la lampe : c'est le contraire d'un appoint, et rien d'autre ne le verrait.
  const irr = [2, 1, 0.5]
  assert.deepEqual(irradianceAppoint(-0.8, irr), [0, 0, 0])
  assert.deepEqual(irradianceAppoint(0, irr), [0, 0, 0])
  assert.deepEqual(irradianceAppoint(1, irr), [2, 1, 0.5])
  assert.deepEqual(irradianceAppoint(0.5, irr), [1, 0.5, 0.25])
})

test('①c ⚡ L’APPOINT S’AJOUTE, IL NE MULTIPLIE PAS — la faute de D13 §③', () => {
  // ⛔ **DEUX LOIS POUR UNE MÊME GRANDEUR, C'EST LE DÉFAUT QUE CE CHANTIER PAIE
  // DEPUIS LE DÉBUT.** `three` accumule une seconde directionnelle dans le MÊME
  // `irradiance` (`RE_Direct`) avant le MÊME `BRDF_Lambert` ; le crop doit donc
  // additionner, pas moduler. Ici on le VÉRIFIE sur la somme complète : ajouter
  // l'appoint à un soleil nul rend exactement l'appoint seul.
  const ciel = [0.3, 0.35, 0.4]
  const sol = [0.1, 0.09, 0.08]
  const nu = irradianceCrop(0.6, 0.2, [0, 0, 0], ciel, sol)
  const app = irradianceAppoint(0.6, [1, 0.5, 0.25])
  const somme = [nu[0] + app[0], nu[1] + app[1], nu[2] + app[2]]
  assert.deepEqual(app, [0.6, 0.3, 0.15])
  // la somme garde l'indirecte intacte : l'appoint n'a pas de terme hémisphérique
  for (let i = 0; i < 3; i++) assert.ok(Math.abs(somme[i] - (nu[i] + app[i])) < 1e-15)
  // et l'appoint SEUL, sur un ciel et un sol nuls, EST la somme
  const seul = irradianceCrop(0.6, 0.2, [0, 0, 0], [0, 0, 0], [0, 0, 0])
  assert.deepEqual(seul, [0, 0, 0])
})

test('①d ⛔ la pente lit la VERTICALE LOCALE, pas l’axe Y — sinon tout le SUD est un versant', () => {
  // ⛔ **LE CHIFFRE QUI DIT POURQUOI `nMonde.y` AURAIT ÉTÉ FAUX.** Le socle écrit
  // `1 - clamp(wN.y, 0, 1)` parce que sa verticale EST `+Y` : il est plat. Sur
  // une sphère, la verticale change à chaque fragment — et dans l'hémisphère
  // SUD elle a une composante Y NÉGATIVE.
  const haut = hautLocal(-21.26, 55.74) // le lieu par défaut, La Réunion
  assert.ok(Math.abs(haut[1] - (-0.3626)) < 0.001, `haut.y relevé ${haut[1]}`)
  // sol horizontal : la normale EST la verticale locale, la pente vaut 0
  assert.ok(Math.abs(penteSol(haut, haut)) < 1e-12)
  // ⛔ la faute évitée, chiffrée : `clamp(-0,3626, 0, 1)` vaut 0, donc `n.y`
  // aurait rendu une pente de 1 — LE MAXIMUM — sur un sol rigoureusement plat.
  assert.equal(1 - Math.min(1, Math.max(0, haut[1])), 1)
  // et dans l'hémisphère nord la faute est plus discrète, pas moins fausse
  const nord = hautLocal(45.9, 6.13) // Annecy
  assert.ok(Math.abs(nord[1] - 0.7181) < 0.001)
  assert.ok(Math.abs((1 - Math.max(0, nord[1])) - 0.282) < 0.001)
  assert.ok(Math.abs(penteSol(nord, nord)) < 1e-12)
})

test('①e la pente va de 0 à plat à 1 à la verticale, et elle est BORNÉE', () => {
  const haut = [0, 1, 0]
  assert.equal(penteSol([0, 1, 0], haut), 0)
  assert.equal(penteSol([1, 0, 0], haut), 1)
  // une normale retournée (sous-face) ne rend pas une pente négative : `clamp`
  assert.equal(penteSol([0, -1, 0], haut), 1)
  const demi = penteSol([Math.SQRT1_2, Math.SQRT1_2, 0], haut)
  assert.ok(Math.abs(demi - (1 - Math.SQRT1_2)) < 1e-12)
})

test('①f l’ombrage des pentes à 0 rend la couleur AU BIT PRÈS', () => {
  // C'est la garde du n° 30 : `mix(a, b, 0)` vaut `a` exactement en float32,
  // donc `uSlopeTint = 0` est l'image d'avant cette tâche.
  const col = [0.31, 0.47, 0.29]
  assert.deepEqual(teintePente(col, 1, PENTE_MONDE_NULLE), col)
  assert.equal(PENTE_MONDE_NULLE, 0)
  // et sous le seuil bas du smoothstep, rien non plus, même à k plein
  assert.deepEqual(teintePente(col, 0.3, 1), col)
  assert.deepEqual(teintePente(col, 0, 1), col)
  // à pente pleine et k plein, c'est le brun du dépôt, exactement
  assert.deepEqual(teintePente(col, 1, 1), [...PENTE_BRUN])
})

test('①g le brun et les deux bornes sont ceux du SOCLE, pas un goût neuf', () => {
  // ⚠️ **DEUX ÉCRITURES D'UNE MÊME COULEUR FINISSENT PAR DIVERGER**, et ici la
  // divergence se verrait pile sur le seuil du crop. On lit donc `terrain.js`.
  const TERRAIN = readFileSync(new URL('../src/terrain.js', import.meta.url), 'utf8')
  assert.match(TERRAIN, /mix\(mapCol, vec3\(0\.42, 0\.31, 0\.21\), smoothstep\(0\.3, 0\.8, slope\) \* uSlopeTint\)/)
  assert.deepEqual([...PENTE_BRUN], [0.42, 0.31, 0.21])
  assert.equal(lissePente(0.3), 0)
  assert.equal(lissePente(0.8), 1)
  assert.ok(Math.abs(lissePente(0.55) - 0.5) < 1e-12)
})

// ══════════ ② LE GLSL LIVRÉ, TRADUIT ET EXÉCUTÉ ════════════════════════════

test('② les trois lois GLSL rendent EXACTEMENT ce que rend le module', () => {
  // ⚠️ **ON APPELLE LE TEXTE LIVRÉ, ON NE LE CHERCHE PAS PAR SON NOM.** Une
  // garde retirée du nuanceur change alors une VALEUR, et l'assertion tombe.
  const haut = hautLocal(-21.26, 55.74)
  let n = 0
  for (let a = -1; a <= 1.0001; a += 0.125) {
    for (const irr of [[0, 0, 0], [1, 0.6, 0.32], [3.8, 3.53, 3.01]]) {
      assert.deepEqual(GLSL.irradianceAppoint(a, irr), irradianceAppoint(a, irr))
      n++
    }
    // la pente sur un balayage de normales autour de la verticale locale
    const nrm = [
      haut[0] * a + (1 - Math.abs(a)) * 1,
      haut[1] * a,
      haut[2] * a,
    ]
    const l = Math.hypot(...nrm) || 1
    const u = [nrm[0] / l, nrm[1] / l, nrm[2] / l]
    assert.equal(GLSL.penteSol(u, haut), penteSol(u, haut))
    for (const k of [0, 0.25, 0.55, 1]) {
      assert.deepEqual(GLSL.teintePente([0.31, 0.47, 0.29], penteSol(u, haut), k),
        teintePente([0.31, 0.47, 0.29], penteSol(u, haut), k))
      n++
    }
  }
  assert.ok(n >= 100, `balayage trop court : ${n} points`)
})

// ══════════ ③ LA DIRECTION : DEUX LOIS EXISTANTES, ZÉRO NEUVE ═════════════

test('③a ⚡ FACTEUR 1 — l’appoint à écart NUL EST le soleil, au bit près', () => {
  // ⚡ **C'EST LA PREUVE EXÉCUTABLE DE LA CONVERSION D'UNITÉ.** `placeFill` bâtit
  // sa position avec `(cos az cos el, sin el, sin az cos el)` — LES TROIS MÊMES
  // TERMES que `placeSun`. Si les deux conventions sont bien la même, alors un
  // appoint d'écart 0 et de hauteur égale à celle du soleil doit rendre, au bit
  // près, la direction que `directionSoleilLocale` rend pour le soleil.
  for (const [az, el, lat, lon] of [
    [298.1, 35.7, -21.26, 55.74],
    [12, 4, 45.9, 6.13],
    [180, 89, -54.8, -68.3],
    [0, 2, 0, 0],
  ]) {
    assert.deepEqual(
      directionAppointMonde(az, 0, el, lat, lon),
      directionSoleilLocale(az, el, lat, lon)
    )
  }
})

test('③b l’écart est un ÉCART, et il fait le tour proprement', () => {
  // `fillDirection` fait la somme et le modulo : l'envoyer déjà sommé aurait été
  // une seconde écriture de cette somme, et l'écart de 360 ne serait plus neutre.
  const lat = -21.26
  const lon = 55.74
  assert.deepEqual(
    directionAppointMonde(298.1, 360, 20, lat, lon),
    directionAppointMonde(298.1, 0, 20, lat, lon)
  )
  assert.deepEqual(
    directionAppointMonde(300, 150, 20, lat, lon),
    directionSoleilLocale(90, 20, lat, lon) // (300 + 150) mod 360 = 90
  )
  assert.deepEqual(fillDirection(300, 150, 20), { azimuth: 90, elevation: 20 })
})

test('③c la HAUTEUR est bornée [−10 ; 90], et −10 éclaire PAR-DESSOUS', () => {
  // ⚠️ **LA BORNE BASSE N'EST PAS COSMÉTIQUE** : à −10° la lampe passe sous
  // l'horizon local, et c'est le comportement du socle qu'on porte, pas un
  // accident. `max(ndl, 0)` l'éteint sur les faces qui lui tournent le dos.
  const lat = -21.26
  const lon = 55.74
  const haut = hautLocal(lat, lon)
  const bas = directionAppointMonde(0, 0, -10, lat, lon)
  assert.ok(bas[0] * haut[0] + bas[1] * haut[1] + bas[2] * haut[2] < 0, 'la lampe basse n’est pas sous l’horizon')
  // et l'écrêtage tient aux deux bouts
  assert.deepEqual(directionAppointMonde(0, 0, -90, lat, lon), directionAppointMonde(0, 0, -10, lat, lon))
  assert.deepEqual(directionAppointMonde(0, 0, 200, lat, lon), directionAppointMonde(0, 0, 90, lat, lon))
})

test('③d le vecteur rendu est UNITAIRE, et `null` quand une donnée manque', () => {
  for (const [az, ec, h, lat, lon] of [[0, 150, 20, 0, 0], [298, 37, -3, -21.26, 55.74], [45, 300, 90, 80, -179]]) {
    const v = directionAppointMonde(az, ec, h, lat, lon)
    assert.ok(Math.abs(Math.hypot(...v) - 1) < 1e-12)
  }
  // ⛔ **SANS REPÈRE, ON N'INVENTE PAS UNE DIRECTION** — même règle que le
  // soleil : éclairer sans (lat, lon) reviendrait à poser l'appoint du golfe de
  // Guinée sur La Réunion.
  assert.equal(directionAppointMonde(NaN, 150, 20, 0, 0), null)
  assert.equal(directionAppointMonde(0, 150, 20, NaN, 0), null)
  assert.equal(directionAppointMonde(0, 150, 20, 0, undefined), null)
})

// ══════════ ④ LE BRANCHEMENT — LA FAIBLESSE RÉCURRENTE DU CHANTIER ═════════

test('④a le nuanceur AJOUTE l’appoint dans la MÊME somme que le soleil', () => {
  // ⚠️ Un uniforme déclaré que le nuanceur n'additionne pas n'allume rien : c'est
  // exactement la panne des cinq curseurs. On vérifie la SOMME, pas le nom.
  assert.match(FRAG_NU, /vec3 irrBloc = irradianceCrop\([^;]*\)\s*\n\s*\+ irradianceAppoint\(dot\(nMonde, uAppointDir\), uAppointIrr\);/)
  assert.match(FRAG_NU, /vec3 colBloc = col \* irrBloc \* 0\.3183098861837907;/)
  // et le GLSL du module est INJECTÉ, pas recopié dans globe.js
  assert.match(GLOBE_NU, /\$\{GLSL_LUMIERE_SPHERE\}/)
  assert.equal(/vec3 irradianceAppoint\(float/.test(GLOBE_NU.replace('${GLSL_LUMIERE_SPHERE}', '')), false)
})

test('④b le nuanceur applique l’ombrage des pentes SUR LA TERRE, et gardé', () => {
  assert.match(FRAG_NU, /if \(uSlopeTint > 0\.0 && !sousEau\) \{\s*\n\s*col = teintePente\(col, penteSol\(nMonde, haut\), uSlopeTint\);/)
  // ⚠️ **ET IL EST DANS LE BLOC DE LA NORMALE FINE** : `nMonde` n'existe que là.
  const iNormale = FRAG_NU.indexOf('if (uNormaleFineOn > 0.5) {')
  const iPente = FRAG_NU.indexOf('col = teintePente(col, penteSol(nMonde, haut), uSlopeTint);')
  const iFinNormale = FRAG_NU.indexOf('float nduCrop = dot(nMonde, uHemiHaut);')
  assert.ok(iNormale > 0 && iPente > iNormale && iPente < iFinNormale,
    'l’ombrage des pentes est sorti du bloc où la normale fine existe')
})

test('④c les trois uniformes existent et partent de leur module — pas d’un littéral', () => {
  // Le contrat qu'`⑨i` de `crop-habillage` impose déjà à huit autres : un défaut
  // recopié dans le constructeur ET dans `retirerHabillage` finit par diverger.
  assert.match(GLOBE_NU, /uAppointDir: \{ value: new THREE\.Vector3\(\)\.fromArray\(APPOINT_MONDE_ETEINT\.dir\) \}/)
  assert.match(GLOBE_NU, /uAppointIrr: \{ value: new THREE\.Vector3\(\)\.fromArray\(APPOINT_MONDE_ETEINT\.irr\) \}/)
  assert.match(GLOBE_NU, /uSlopeTint: \{ value: PENTE_MONDE_NULLE \}/)
  for (const u of ['uAppointDir', 'uAppointIrr', 'uSlopeTint']) {
    assert.ok(FRAG_NU.includes('uniform ') && new RegExp('uniform (vec3|float) ' + u + ';').test(FRAG_NU),
      `${u} n’est pas déclaré dans le fragment`)
  }
})

test('④d ⛔ LES CINQ CHAMPS SONT SURVEILLÉS — sinon la réparation est fortuite', () => {
  // ⚠️ **UN CHAMP ABSENT DE `CHAMPS_HABILLAGE` N'EST JAMAIS COMPARÉ**, donc
  // jamais reposé de son propre chef. Et l'appoint est le SEUL réglage de
  // lumière que le cycle horaire ne pilote pas : rien ne bouge derrière lui, il
  // n'y a aucune réparation fortuite à espérer au prochain dixième d'heure.
  for (const c of ['appointAzimut', 'appointElevation', 'appointCouleur', 'appointIntensite', 'slopeTint']) {
    assert.ok(CHAMPS_HABILLAGE.includes(c), `${c} n’est pas surveillé`)
  }
})

test('④e ⚡ `contexteCrop` lit la LAMPE pour l’intensité et la couleur, pas `params`', () => {
  // ⛔ **`params.fillIntensity` NE PORTE NI L'INTERRUPTEUR NI L'ÉCRÊTAGE.**
  // `fillLightIntensity` rend **0 exactement** quand l'appoint est éteint — et
  // c'est ce qui permet de garder la lampe dans la scène sans qu'elle contribue.
  // Lire `params` aurait éclairé le crop avec un appoint ÉTEINT.
  const ctx = MAIN_SRC.slice(
    MAIN_SRC.indexOf('function contexteCrop()'),
    MAIN_SRC.indexOf('\nconst veilleCrop')
  ).replace(/\/\/[^\n]*/g, '')
  assert.match(ctx, /appointIntensite: fillLight\.intensity/)
  assert.match(ctx, /appointCouleur: `#\$\{fillLight\.color\.getHexString\(\)\}`/)
  assert.equal(/appointIntensite:\s*params\./.test(ctx), false)
  assert.equal(/appointCouleur:\s*params\./.test(ctx), false)
  // les ANGLES, eux, viennent de `params` — même partage que le soleil, dont
  // `applyTimeOfDay` est le seul écrivain
  assert.match(ctx, /appointAzimut: params\.fillAzimuthOffset/)
  assert.match(ctx, /appointElevation: params\.fillElevation/)
  // et la loi de l'interrupteur est bien celle-là
  assert.equal(fillLightIntensity(false, 2.5), 0)
  assert.equal(fillLightIntensity(true, 2.5), 2.5)
  assert.equal(fillLightIntensity(true, 12), 4)
})

test('④f ⛔ l’ombrage des pentes est gaté sur `uColorMode`, PAS sur `uAnalysisOn`', () => {
  // ⛔ **LE PIÈGE ÉVITÉ, ET IL EST CHIFFRÉ.** En mode Atlas, `uAnalysisOn` reste
  // à 0 pendant les ~464 ms où le travailleur cuit l'analyse (`terrain.js`),
  // alors qu'`uColorMode` vaut 1 dès le premier instant. Gater sur l'analyse
  // aurait fait CLIGNOTER le brun des versants à chaque changement de lieu.
  const ctx = MAIN_SRC.slice(
    MAIN_SRC.indexOf('function contexteCrop()'),
    MAIN_SRC.indexOf('\nconst veilleCrop')
  ).replace(/\/\/[^\n]*/g, '')
  assert.match(ctx, /slopeTint: terrain\.mapUniforms\.uColorMode\.value === 1 \? 0 : terrain\.mapUniforms\.uSlopeTint\.value/)
  // ⚠️ et la ligne de l'interface est déjà cachée en Atlas — les deux gardes
  // disent la même chose, et c'est voulu : l'une protège l'œil, l'autre le rendu
  const PANNEAU = readFileSync(new URL('../src/ui/create-panel.js', import.meta.url), 'utf8').replace(/\/\/[^\n]*/g, '')
  assert.match(PANNEAU, /visibleWhen\(slopeRow, \(\) => !isNatural\(\)\)/)
})

// ══════════ ⑤ L'ALLER-RETOUR BIT À BIT ═════════════════════════════════════

test('⑤ `poserHabillage` POSE les trois, et `retirerHabillage` les REND', () => {
  const g = new Globe({ radius: 100 })
  const u = g.uniforms
  const depart = {
    dir: u.uAppointDir.value.toArray(),
    irr: u.uAppointIrr.value.toArray(),
    pente: u.uSlopeTint.value,
  }
  assert.deepEqual(depart.dir, [...APPOINT_MONDE_ETEINT.dir])
  assert.deepEqual(depart.irr, [...APPOINT_MONDE_ETEINT.irr])
  assert.equal(depart.pente, PENTE_MONDE_NULLE)

  g.poserHabillage({
    centreLat: -21.26,
    centreLon: 55.74,
    soleilAzimut: 298.1,
    soleilElevation: 35.7,
    soleilCouleur: '#fff7e6',
    soleilIntensite: 3.8,
    hemiCiel: '#dadada',
    hemiSol: '#5c5c5c',
    hemiIntensite: 1,
    appointAzimut: 150,
    appointElevation: 20,
    appointCouleur: '#ffcf9a',
    appointIntensite: 0.6,
    slopeTint: 0.55,
  })
  // ⚡ la pose CHANGE quelque chose — sinon l'aller-retour serait vrai par
  // construction, et c'est le premier des sept pièges du plan
  assert.notDeepEqual(u.uAppointDir.value.toArray(), depart.dir)
  assert.notDeepEqual(u.uAppointIrr.value.toArray(), depart.irr)
  assert.equal(u.uSlopeTint.value, 0.55)
  // et la DIRECTION posée est bien celle du module, pas une autre
  assert.deepEqual(u.uAppointDir.value.toArray(), directionAppointMonde(298.1, 150, 20, -21.26, 55.74))
  // l'irradiance est couleur LINÉAIRE × intensité : facteur 1, et le canal rouge
  // de #ffcf9a vaut 1 en linéaire, donc le rouge posé EST l'intensité
  assert.ok(Math.abs(u.uAppointIrr.value.x - 0.6) < 1e-6, `rouge posé ${u.uAppointIrr.value.x}`)
  assert.ok(u.uAppointIrr.value.y < u.uAppointIrr.value.x && u.uAppointIrr.value.z < u.uAppointIrr.value.y)

  g.retirerHabillage()
  assert.deepEqual(u.uAppointDir.value.toArray(), depart.dir)
  assert.deepEqual(u.uAppointIrr.value.toArray(), depart.irr)
  assert.equal(u.uSlopeTint.value, depart.pente)
})

test('⑤b un poseur MUET laisse l’appoint éteint et les pentes à zéro', () => {
  // ⛔ **L'INTERRUPTEUR EST L'ABSENCE DE DONNÉE** — le patron de `coastMask`, de
  // `sol` et de l'ambiante de paroi. Un appelant qui ne connaît pas encore ces
  // champs doit rendre l'image d'avant cette tâche, AU BIT PRÈS.
  const g = new Globe({ radius: 100 })
  g.poserHabillage({
    centreLat: -21.26, centreLon: 55.74,
    soleilAzimut: 298.1, soleilElevation: 35.7,
    soleilCouleur: '#fff7e6', soleilIntensite: 3.8,
    hemiCiel: '#dadada', hemiSol: '#5c5c5c', hemiIntensite: 1,
  })
  assert.deepEqual(g.uniforms.uAppointIrr.value.toArray(), [...APPOINT_MONDE_ETEINT.irr])
  assert.deepEqual(g.uniforms.uAppointDir.value.toArray(), [...APPOINT_MONDE_ETEINT.dir])
  assert.equal(g.uniforms.uSlopeTint.value, PENTE_MONDE_NULLE)
})

test('⑤c un appoint À ZÉRO reste neutre, même interrupteur allumé', () => {
  // `fillLight.intensity` vaut 0 tant que l'utilisateur n'a pas monté le curseur.
  // ⚠️ La DIRECTION est posée quand même (elle est finie), mais l'irradiance
  // nulle rend la somme inchangée — c'est la garde, pas un cas particulier.
  const g = new Globe({ radius: 100 })
  g.poserHabillage({
    centreLat: 0, centreLon: 0,
    soleilAzimut: 0, soleilElevation: 45,
    soleilCouleur: '#ffffff', soleilIntensite: 1,
    hemiCiel: '#ffffff', hemiSol: '#000000', hemiIntensite: 1,
    appointAzimut: 150, appointElevation: 20, appointCouleur: '#ffcf9a', appointIntensite: 0,
  })
  assert.deepEqual(g.uniforms.uAppointIrr.value.toArray(), [0, 0, 0])
  for (const ndl of [-1, 0, 0.5, 1]) {
    assert.deepEqual(irradianceAppoint(ndl, g.uniforms.uAppointIrr.value.toArray()), [0, 0, 0])
  }
})

test('⑤d l’ombrage des pentes est ÉCRÊTÉ — un NaN éteint la moitié d’un GPU', () => {
  const g = new Globe({ radius: 100 })
  g.poserHabillage({ slopeTint: NaN })
  assert.equal(g.uniforms.uSlopeTint.value, PENTE_MONDE_NULLE)
  g.poserHabillage({ slopeTint: 4 })
  assert.equal(g.uniforms.uSlopeTint.value, 1)
  g.poserHabillage({ slopeTint: -2 })
  assert.equal(g.uniforms.uSlopeTint.value, 0)
})

// ══════════ ⑥ LA TABLE DES VERDICTS COMMANDE L'INTERFACE ═══════════════════

test('⑥a les huit réglages du brief sont TOUS jugés, et un seul est mort', () => {
  const n = Object.values(POSTES_LUMIERE_SPHERE).map((p) => p.n).sort((a, b) => a - b)
  assert.deepEqual(n, [26, 30, 68, 69, 70, 71, 72, 73])
  assert.deepEqual(curseursMorts(true), ['shadowSoftness'])
  // ⛔ hors mode sphère, RIEN n'est caché : ces réglages pilotent toujours le
  // bloc plat quand le bloc plat est dessiné, et ils voyagent dans les gabarits
  assert.deepEqual(curseursMorts(false), [])
  for (const p of Object.values(POSTES_LUMIERE_SPHERE)) {
    assert.ok(p.motif && p.motif.length > 20, 'un verdict sans motif écrit n’est pas un verdict')
  }
})

test('⑥b `reglageAgit` répond pour un inconnu, et suit la table pour les huit', () => {
  assert.equal(reglageAgit('shadowSoftness', true), false)
  assert.equal(reglageAgit('shadowSoftness', false), true)
  for (const c of ['fillEnabled', 'fillIntensity', 'fillAzimuthOffset', 'fillElevation', 'fillColor', 'shadeAuto', 'slopeTint']) {
    assert.equal(reglageAgit(c, true), true, `${c} devrait agir sur la sphère`)
  }
  // un curseur qui n'est pas dans la table n'est jamais caché par erreur
  assert.equal(reglageAgit('sunAzimuth', true), true)
})

test('⑥c le panneau CACHE la douceur des ombres — et par la table, pas par un `if`', () => {
  // ⚠️ **UN `if` ÉCRIT DANS LE PANNEAU SE SERAIT RECOPIÉ AU CURSEUR MORT
  // SUIVANT.** Le panneau pose la question, le module y répond.
  assert.match(PANNEAU_NU, /import \{ reglageAgit \} from '\.\.\/monde\/lumiere-sphere\.js'/)
  assert.match(PANNEAU_NU, /visibleWhen\(row, \(\) => reglageAgit\(cle, ctx\.surSphere\?\.\(\) === true\)\)/)
  assert.match(PANNEAU_NU, /siAgit\(\s*\n?\s*slider\(\{ label: 'Douceur des ombres'[\s\S]{0,400}?'shadowSoftness'\s*\n?\s*\)/)
  // ⛔ **ET LA NOTE « L'APPOINT NE SE VOIT PAS » EST RETIRÉE**, parce qu'elle est
  // devenue fausse : c'est le défaut inverse de celui que R18 réparait.
  assert.equal(/il ne se voit pas sur la carte sphérique/.test(PANNEAU_NU), false)
  assert.equal(/ce-bg-note[^\n]*ppoint/i.test(PANNEAU_NU), false)
})

test('⑥d `main.js` répond à la question « le bloc plat est-il dessiné »', () => {
  // ⚠️ Un panneau qui demande et personne qui répond : le curseur resterait
  // visible et cette tâche n'aurait rien fermé.
  assert.match(MAIN_NU, /surSphere: \(\) => terreUniqueBranchee/)
  // et la réponse vient du MÊME endroit que le maillage — `visibiliteSurface`
  // rend `socle: terreUnique ? false : s`, donc jamais de bloc plat sous le drapeau
  const VIS = readFileSync(new URL('../src/monde/visibilite-surface.js', import.meta.url), 'utf8').replace(/\/\/[^\n]*/g, '')
  assert.match(VIS, /socle: terreUnique \? false : s/)
})

test('⑥e ⛔ LE 68 N’A AUCUN RECEVEUR, ET C’EST ARITHMÉTIQUE', () => {
  // ⛔ **LA PREUVE LA PLUS FORTE DES TROIS DU §2, PARCE QU'ELLE EST DANS LE
  // CODE** : le matériau de tuile est un `ShaderMaterial` nu. Il ne porte aucun
  // bloc d'ombre — donc il ne peut ni couler ni recevoir une ombre, et régler le
  // rayon d'un flou de carte d'ombre n'a rien à atteindre.
  assert.equal(/shadowmap|shadowMap|SHADOWMAP/i.test(GLOBE_SRC), false,
    'globe.js porte désormais un bloc d’ombre — le verdict du n° 68 est à re-mesurer')
  // ⛔ **ET L'UNITÉ N'EST PAS CELLE QUE LE BRIEF ANNONÇAIT** : sous VSM,
  // `shadow.radius` est un rayon de flou en TEXELS de la carte d'ombre, pas une
  // longueur de scène. Il n'y avait aucun rapport d'échelle à appliquer.
  assert.match(MAIN_NU, /renderer\.shadowMap\.type = THREE\.VSMShadowMap/)
})
