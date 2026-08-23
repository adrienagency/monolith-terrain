// L'ÉCLAIRAGE DU CROP — Tâche P3 du plan « LE STUDIO SUR LE GLOBE »
// (`docs/superpowers/plans/2026-08-22-globe-studio.md`).
//
// ══════════ CE QUE CE FICHIER VÉRIFIE, ET CE QU'IL NE PEUT PAS ══════════════
//
// Même partage que `crop-naturel`, dont il reprend le protocole :
//   ① LA LOI vit dans des modules PURS (`monde/eclairage-crop.js`,
//      `monde/melange-crop.js`) et se vérifie sous node, point par point ;
//   ② LE TEXTE GLSL est **TRADUIT ET EXÉCUTÉ**, jamais cherché par son nom —
//      la Tâche K ter a trouvé une assertion verte parce qu'elle lisait une
//      formule DANS UN COMMENTAIRE ;
//   ③ **L'UNICITÉ DE L'ÉCRITURE** est elle-même une assertion ;
//   ④ le BRANCHEMENT, qui est la faiblesse récurrente de ce chantier ;
//   ⑤ les gardes du nuanceur, ÉVALUÉES ;
//   ⑥ ⚡ **ET LA RÉFÉRENCE EST LUE DANS `node_modules/three`** : la loi
//      d'éclairage n'est pas maison, c'est celle de `MeshPhysicalMaterial`.
//      Ce fichier ouvre les chunks de three et exige que le module les suive.
//      Le jour où three change d'avis, ce test rougit.
//
// ⚠️ **CE QUI RESTE HORS DE PORTÉE** : que le GPU exécute ce texte, et que
// l'image obtenue ressemble à celle du socle. Seul l'écran le dit — c'est le
// compte rendu de la tâche (`.superpowers/sdd/2026-08-22-globe-studio/rapport-P3.md`)
// et les relevés de `.banc/vues-P3/`, pas ce fichier.

import test from 'node:test'
import assert from 'node:assert/strict'
import { readFileSync } from 'node:fs'

import {
  RECIPROQUE_PI,
  GRIS_BAS,
  GRIS_HAUT,
  GRIS_EXPO,
  PENTE_BAS,
  PENTE_HAUT,
  PENTE_EXPO,
  OMBRE_GAIN,
  OMBRE_MIN,
  OMBRE_MAX,
  ECLAIRAGE_MONDE,
  natGris,
  natOmbrePeinture,
  natLum,
  albedoCrop,
  irradianceCrop,
  eclairerCrop,
  hautLocal,
  directionSoleilLocale,
  irradianceAmbiante,
  environnementEffectif,
  GLSL_ECLAIRAGE,
  GLSL_OMBRE_PEINTURE,
  // ⚠️ **La normale par fragment — Tache P9, RÉÉCRITE PAR P10.**
  repereSolSphere,
  normaleParGradientSol,
  GLSL_REPERE_SOL,
  GLSL_NORMALE_FINE,
} from '../src/monde/eclairage-crop.js'
import { GLSL_MELANGE, APPARENCE_MONDE } from '../src/monde/melange-crop.js'
// ⚠️ **L'ORACLE DU REPÈRE DE SOL — Tâche P10.** `repereSolSphere` PRÉTEND être
// la dérivée de `latLonToSphere` ; on la lui oppose plutôt que de croire son
// commentaire. C'est la même discipline que ⑧c, qui lit `three`.
import { latLonToSphere, tileToLatLon, R_GLOBE, EARTH_RADIUS_M } from '../src/geo.js'
import { LUMA_709 } from '../src/monde/naturel-crop.js'
import { CHAMPS_HABILLAGE, habillageDifferent } from '../src/monde/branchement-crop.js'
import { HABILLAGE_MONDE } from '../src/monde/habillage-crop.js'
// ⚠️ **Tache P6** : le morceau d irradiance DETACHE, pour les parois.
import { GLSL_IRRADIANCE } from '../src/monde/eclairage-crop.js'

// ⚠️ **`new Globe()` NE TIENT PAS SOUS NODE SANS CE POSTICHE** : `rebuildRamp`
// appelle `document.createElement('canvas')` au constructeur. C'est le patron de
// `test/loi-texture-monde.test.js` et de `test/damier-cadre.test.js`.
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
const TERRAIN_SRC = readFileSync(new URL('../src/terrain.js', import.meta.url), 'utf8')
const MAIN_SRC = readFileSync(new URL('../src/main.js', import.meta.url), 'utf8')
const FRAG_GLOBE = GLOBE_SRC.slice(
  GLOBE_SRC.indexOf('const FRAG ='),
  GLOBE_SRC.indexOf('\nconst ', GLOBE_SRC.indexOf('const FRAG =') + 10)
)
/** Le même fragment, SANS SES COMMENTAIRES — un commentaire n'est pas du code. */
const FRAG_NU = FRAG_GLOBE.replace(/\/\/[^\n]*/g, '')
const TERRAIN_NU = TERRAIN_SRC.replace(/\/\/[^\n]*/g, '')
const GLOBE_NU = GLOBE_SRC.replace(/\/\/[^\n]*/g, '')

// ══════════ L'OUTILLAGE — TRADUIRE LE GLSL, PUIS L'EXÉCUTER ════════════════

const CLAMP = (x, a, b) => Math.min(Math.max(x, a), b)
const MIX = (a, b, t) => a + (b - a) * t

/**
 * Le TEXTE de `GLSL_ECLAIRAGE`, rendu exécutable en JS — canal par canal.
 *
 * ⚠️ **AUCUNE FORMULE N'EST RÉÉCRITE ICI** : seuls les MOTS du langage sont
 * remplacés. Si une constante du nuanceur change, la traduction la porte, et la
 * comparaison au jumeau JS tombe.
 *
 * ⚠️ **`natLuminance` MÉLANGE LES CANAUX, DONC IL EST FOURNI DE L'EXTÉRIEUR** —
 * et le fournisseur VÉRIFIE l'argument qu'on lui passe (voir ②c). C'est ce qui
 * empêche la traduction de « réussir » sur une fonction qui luminancerait autre
 * chose que son fond.
 */
function traduire(glsl) {
  return glsl
    .replace(/\/\/[^\n]*/g, '')
    .replace(/\b(?:float|vec3|vec4)\s+(\w+)\s*\(([^)]*)\)\s*\{/g, (_, nom, args) => {
      const noms = args
        .split(',')
        .map((a) => a.trim().split(/\s+/).pop())
        .filter(Boolean)
      return `function ${nom}(${noms.join(', ')}) {`
    })
    .replace(/\bvec3\s*\(/g, '(')
    .replace(/\b(?:float|vec3|vec4)\s+(\w+)\s*=/g, 'let $1 =')
    .replace(/\bclamp\s*\(/g, 'CLAMP(')
    .replace(/\bmix\s*\(/g, 'MIX(')
    .replace(/\bmax\s*\(/g, 'Math.max(')
    .replace(/\bmin\s*\(/g, 'Math.min(')
    .replace(/\bpow\s*\(/g, 'Math.pow(')
}

/** Le nuanceur exécutable, pour UN canal, avec sa luminance fournie. */
function nuanceur(natLuminance) {
  // eslint-disable-next-line no-new-func
  return new Function(
    'CLAMP',
    'MIX',
    'natLuminance',
    `${traduire(GLSL_ECLAIRAGE)}
     return { natGris, natOmbrePeinture, albedoCrop, irradianceCrop, eclairerCrop }`
  )(CLAMP, MIX, natLuminance)
}

/** Un balayage reproductible — pas de hasard, donc pas de test qui clignote. */
function* balayage(n = 37) {
  for (let i = 0; i <= n; i++) yield i / n
}

// ══════════ ① LA LOI PURE — LES CONSTANTES ONT UNE SOURCE ══════════════════

test('①a chaque constante remonte à une ligne de terrain.js ou de three', () => {
  // `terrain.js`, boucle « vertex tint »
  assert.equal(GRIS_BAS, 0.62)
  assert.equal(GRIS_HAUT, 0.95)
  assert.equal(GRIS_EXPO, 0.85)
  assert.equal(PENTE_BAS, 0.78)
  assert.equal(PENTE_HAUT, 1)
  assert.equal(PENTE_EXPO, 0.6)
  // `terrain.js` : `float fxShade = clamp(luma * 2.4, 0.2, 1.4);`
  assert.equal(OMBRE_GAIN, 2.4)
  assert.equal(OMBRE_MIN, 0.2)
  assert.equal(OMBRE_MAX, 1.4)
  // et `1 / PI` est bien `1 / PI`, pas un 0,318 arrondi à la main
  assert.ok(Math.abs(RECIPROQUE_PI - 1 / Math.PI) < 1e-15)
})

test('①b ⚡ LA LOI D’ÉCLAIRAGE EST CELLE DE three — lue dans node_modules', () => {
  // ⚠️ **ON OUVRE LES CHUNKS, ON NE CITE PAS UN SOUVENIR.** Trois faits sont
  // exigés du dépôt de three, et chacun est une brique de `irradianceCrop`.
  const commun = readFileSync(
    new URL('../node_modules/three/src/renderers/shaders/ShaderChunk/common.glsl.js', import.meta.url),
    'utf8'
  )
  const lights = readFileSync(
    new URL('../node_modules/three/src/renderers/shaders/ShaderChunk/lights_pars_begin.glsl.js', import.meta.url),
    'utf8'
  )
  // ① BRDF_Lambert est bien RECIPROCAL_PI × diffuseColor, et RECIPROCAL_PI est 1/PI
  const corpsCommun = commun.replace(/\s+/g, ' ')
  assert.match(corpsCommun, /vec3 BRDF_Lambert\( const in vec3 diffuseColor \) \{ return RECIPROCAL_PI \* diffuseColor; \}/)
  const mPi = corpsCommun.match(/#define RECIPROCAL_PI ([0-9.]+)/)
  assert.ok(mPi, 'RECIPROCAL_PI est défini dans common.glsl.js')
  assert.ok(Math.abs(Number(mPi[1]) - RECIPROQUE_PI) < 1e-9, `${mPi[1]} contre ${RECIPROQUE_PI}`)
  // ② l'hémisphère est bien mix(sol, ciel, 0,5·dotNL + 0,5)
  const corpsHemi = lights.replace(/\s+/g, ' ')
  assert.match(corpsHemi, /float dotNL = dot\( normal, hemiLight\.direction \);/)
  assert.match(corpsHemi, /float hemiDiffuseWeight = 0\.5 \* dotNL \+ 0\.5;/)
  assert.match(corpsHemi, /vec3 irradiance = mix\( hemiLight\.groundColor, hemiLight\.skyColor, hemiDiffuseWeight \);/)
  // ③ et la même loi, évaluée par NOTRE module, sur les mêmes entrées
  for (const t of balayage(19)) {
    const ndu = t * 2 - 1
    const attendu = MIX(0.3, 0.8, 0.5 * ndu + 0.5)
    const [r] = irradianceCrop(0, ndu, [0, 0, 0], [0.8, 0.8, 0.8], [0.3, 0.3, 0.3])
    assert.ok(Math.abs(r - attendu) < 1e-12, `ndu=${ndu}`)
  }
})

test('①c natGris borne SES DEUX entrées — sinon Math.pow rend NaN', () => {
  // ⚠️ `terrain.js` documente en douze lignes le sommet qui passe sous `minH`
  // sur un champ alpin (421 à 433 sommets sur 4 225 mesurés). Un NaN dans
  // l'attribut `color` ne lève RIEN : il peint un sommet noir ou transparent
  // selon le pilote.
  assert.ok(Number.isFinite(natGris(-0.3, 0.5)))
  assert.ok(Number.isFinite(natGris(0.5, -0.9)))
  assert.equal(natGris(-1, -1), GRIS_BAS * PENTE_BAS)
  // et le domaine utile est monotone croissant en hn ET en ny
  let precedent = -1
  for (const t of balayage()) {
    const v = natGris(t, 1)
    assert.ok(v >= precedent, `hn=${t}`)
    precedent = v
  }
  assert.equal(natGris(0, 1), GRIS_BAS)
  assert.equal(natGris(1, 1), GRIS_HAUT)
})

test('①d natOmbrePeinture est bornée aux DEUX bouts, et le plafond MORD', () => {
  // ⚠️ **CE N'EST PAS DÉCORATIF** : relevé dans l'application vivante, le fond
  // du socle (params.color × la valeur par sommet) a une luminance moyenne de
  // **0,68** — donc `0,68 × 2,4 = 1,63`, donc le PLAFOND. Une borne qu'on croit
  // inutile et qui décide de tout, c'est la classe de défaut que ce chantier a
  // trouvée quatre fois.
  assert.equal(natOmbrePeinture(0), OMBRE_MIN)
  assert.equal(natOmbrePeinture(10), OMBRE_MAX)
  assert.equal(natOmbrePeinture(0.68), OMBRE_MAX)
  assert.ok(Math.abs(natOmbrePeinture(0.4) - 0.96) < 1e-12)
})

test('①e albedoCrop EST le mix de terrain.js:1146, et la teinte le pilote', () => {
  const base = [0.855, 0.8963, 0.9387]
  const carte = [0.3, 0.4, 0.32]
  // teinte 0 → le fond seul ; teinte 1 → la peinture dosée seule
  const t0 = albedoCrop(carte, base, 0.8, 0)
  assert.deepEqual(t0, [base[0] * 0.8, base[1] * 0.8, base[2] * 0.8])
  const ombre = natOmbrePeinture(natLum([base[0] * 0.8, base[1] * 0.8, base[2] * 0.8]))
  const t1 = albedoCrop(carte, base, 0.8, 1)
  for (let k = 0; k < 3; k++) assert.ok(Math.abs(t1[k] - carte[k] * ombre) < 1e-12)
  // et le vivant est bien l'interpolation des deux
  const tv = albedoCrop(carte, base, 0.8, 0.68)
  for (let k = 0; k < 3; k++) assert.ok(Math.abs(tv[k] - MIX(t0[k], t1[k], 0.68)) < 1e-12)
})

test('①f natLum porte les MÊMES poids que natLuminance du GLSL partagé', () => {
  assert.deepEqual([...LUMA_709], [0.2126, 0.7152, 0.0722])
  assert.ok(Math.abs(natLum([1, 1, 1]) - 1) < 1e-12)
  assert.ok(Math.abs(natLum([1, 0, 0]) - LUMA_709[0]) < 1e-15)
})

test('①g le soleil direct est BORNÉ À ZÉRO, l’hémisphère NON', () => {
  // ⚠️ C'est `saturate(dot(N, L))` chez three pour la directe, et un `dotNL`
  // NON borné pour l'hémisphère : sa face basse DOIT recevoir la couleur du sol.
  const [r] = irradianceCrop(-1, 0, [2, 2, 2], [0, 0, 0], [0, 0, 0])
  assert.equal(r, 0)
  const [bas] = irradianceCrop(0, -1, [0, 0, 0], [1, 1, 1], [0.25, 0.25, 0.25])
  assert.equal(bas, 0.25) // plein sol
  const [haut] = irradianceCrop(0, 1, [0, 0, 0], [1, 1, 1], [0.25, 0.25, 0.25])
  assert.equal(haut, 1) // plein ciel
})

// ══════════ ② LE TEXTE GLSL, TRADUIT ET EXÉCUTÉ ════════════════════════════

test('②a natGris : le GLSL et le jumeau JS rendent le même nombre', () => {
  const N = nuanceur(() => 0)
  let n = 0
  for (const hn of balayage(23)) {
    for (const ny of balayage(23)) {
      const a = N.natGris(hn * 1.4 - 0.2, ny * 1.4 - 0.2)
      const b = natGris(hn * 1.4 - 0.2, ny * 1.4 - 0.2)
      assert.ok(Math.abs(a - b) < 1e-12, `hn=${hn} ny=${ny} ${a} ${b}`)
      n++
    }
  }
  assert.equal(n, 24 * 24) // le dénominateur est COMPTÉ, pas annoncé
})

test('②b natOmbrePeinture : le GLSL et le jumeau JS rendent le même nombre', () => {
  const N = nuanceur(() => 0)
  let n = 0
  for (const t of balayage(101)) {
    const lum = t * 2
    assert.equal(N.natOmbrePeinture(lum), natOmbrePeinture(lum))
    n++
  }
  assert.equal(n, 102)
})

test('②c albedoCrop : le GLSL exécuté canal par canal, avec SA luminance vérifiée', () => {
  // ⚠️ **LE FOURNISSEUR DE `natLuminance` VÉRIFIE SON ARGUMENT.** Sans cela, un
  // nuanceur qui luminancerait la carte au lieu du fond passerait le test.
  const base = [0.855, 0.8963, 0.9387]
  const carte = [0.31, 0.42, 0.28]
  let appels = 0
  let n = 0
  for (const t of balayage(11)) {
    for (const u of balayage(11)) {
      const gris = natGris(t, u)
      const fond = base.map((b) => b * gris)
      const lum = natLum(fond)
      const attendu = albedoCrop(carte, base, gris, 0.68)
      for (let k = 0; k < 3; k++) {
        const N = nuanceur((arg) => {
          appels++
          assert.ok(Math.abs(arg - fond[k]) < 1e-12, 'natLuminance reçoit le FOND du canal courant')
          return lum
        })
        const got = N.albedoCrop(carte[k], base[k], gris, 0.68)
        assert.ok(Math.abs(got - attendu[k]) < 1e-12)
      }
      n++
    }
  }
  assert.equal(n, 144)
  assert.equal(appels, 144 * 3)
})

test('②d irradianceCrop et eclairerCrop : le GLSL contre les jumeaux', () => {
  const base = [0.855, 0.8963, 0.9387]
  const carte = [0.31, 0.42, 0.28]
  const soleil = [3.74, 3.48, 2.96]
  const ciel = [2.83, 3.07, 3.31]
  const sol = [0.47, 0.45, 0.43]
  let n = 0
  for (const t of balayage(9)) {
    for (const u of balayage(9)) {
      const hn = t
      const ndu = u * 2 - 1
      const ndl = 1 - 2 * t
      const gris = natGris(hn, Math.max(0, ndu))
      const fond = base.map((b) => b * gris)
      const lum = natLum(fond)
      const attIrr = irradianceCrop(ndl, ndu, soleil, ciel, sol)
      const attCol = eclairerCrop({ mapCol: carte, base, teinte: 0.68, hn, ndu, ndl, soleil, ciel, sol })
      for (let k = 0; k < 3; k++) {
        const N = nuanceur(() => lum)
        const irr = N.irradianceCrop(ndl, ndu, soleil[k], ciel[k], sol[k])
        assert.ok(Math.abs(irr - attIrr[k]) < 1e-12)
        const col = N.eclairerCrop(carte[k], base[k], 0.68, hn, ndu, ndl, soleil[k], ciel[k], sol[k])
        assert.ok(Math.abs(col - attCol[k]) < 1e-12, `k=${k} ${col} ${attCol[k]}`)
      }
      n++
    }
  }
  assert.equal(n, 100)
})

test('②e GLSL_ECLAIRAGE CONTIENT GLSL_OMBRE_PEINTURE — une écriture, deux lecteurs', () => {
  // `terrain.js` n'injecte que la petite part ; `globe.js` prend le tout. Si les
  // deux textes divergeaient, `fxShade` ne serait plus le même des deux côtés.
  assert.ok(GLSL_ECLAIRAGE.includes(GLSL_OMBRE_PEINTURE.trim()))
  assert.match(GLSL_OMBRE_PEINTURE, /clamp\(lum \* 2\.4, 0\.2, 1\.4\)/)
})

// ══════════ ③ L'UNICITÉ DE L'ÉCRITURE ══════════════════════════════════════

test('③a terrain.js DÉLÈGUE la valeur par sommet et fxShade, il ne les réécrit pas', () => {
  assert.match(TERRAIN_SRC, /import \{ natGris, GLSL_OMBRE_PEINTURE \} from '\.\/monde\/eclairage-crop\.js'/)
  assert.match(TERRAIN_NU, /\$\{GLSL_OMBRE_PEINTURE\}/)
  assert.match(TERRAIN_NU, /let v = natGris\(hn, ny\)/)
  assert.match(TERRAIN_NU, /float fxShade = natOmbrePeinture\(luma\);/)
  // ⛔ et AUCUNE des deux formules ne reparaît, commentaires retirés
  assert.equal(/clamp\(\s*luma\s*\*\s*2\.4/.test(TERRAIN_NU), false)
  assert.equal(/lerp\(0\.62,\s*0\.95/.test(TERRAIN_NU), false)
  assert.equal(/lerp\(0\.78,\s*1\.0/.test(TERRAIN_NU), false)
})

test('③b les modes de mélange ne sont plus écrits deux fois', () => {
  // ⚠️ `blLum` / `blClip` / `blSetLum` vivaient dans les DEUX fichiers, chacun
  // avec un commentaire annonçant que deux écritures finiraient par diverger.
  assert.match(TERRAIN_NU, /\$\{GLSL_MELANGE\}/)
  assert.match(GLOBE_NU, /\$\{GLSL_MELANGE\}/)
  for (const src of [TERRAIN_NU, GLOBE_NU]) {
    assert.equal(/vec3 blSetLum\(vec3 c, float l\) \{ return blClip/.test(src), false)
    assert.equal(/vec3 fxBlend\(vec3 b, vec3 s, int m\) \{/.test(src), false)
  }
  assert.match(GLSL_MELANGE, /vec3 fxBlend\(vec3 b, vec3 s, int m\) \{/)
  assert.match(GLSL_MELANGE, /if \(m == 10\) return natSoftLight\(b, s\);/)
})

test('③c la couche Apparence PASSE PAR fx-glsl.js, elle n’est pas recopiée', () => {
  assert.match(GLOBE_SRC, /import \{ FX_GLSL \} from '\.\/fx-glsl\.js'/)
  assert.match(FRAG_NU, /\$\{FX_GLSL\}/)
  // et le corps de `surfaceFx` n'est nulle part dans `globe.js`
  assert.equal(/vec3 surfaceFx\(int id, vec2 p, float t\)/.test(GLOBE_NU), false)
})

test('③d globe.js n’écrit pas sa propre loi d’éclairage', () => {
  assert.match(GLOBE_SRC, /from '\.\/monde\/eclairage-crop\.js'/)
  assert.match(FRAG_NU, /\$\{GLSL_ECLAIRAGE\}/)
  // aucune seconde écriture des formules, commentaires retirés
  assert.equal(/0\.5 \* ndu \+ 0\.5/.test(FRAG_NU.replace('${GLSL_ECLAIRAGE}', '')), false)
  assert.equal(/clamp\(\s*\w+\s*\* 2\.4, 0\.2, 1\.4\)/.test(FRAG_NU), false)
})

// ══════════ ④ LE BRANCHEMENT — la faiblesse récurrente de ce chantier ══════

const CHAMPS_P3 = [
  'centreLat',
  'centreLon',
  'soleilAzimut',
  'soleilElevation',
  'soleilCouleur',
  'soleilIntensite',
  'hemiCiel',
  'hemiSol',
  'hemiIntensite',
  'ambianteCoef',
  'ambianteIntensite',
  // ⚠️ **LES DEUX DE LA PAROI — Tâche P8.** Elles sont dans cette liste-ci et
  // pas seulement dans `CHAMPS_HABILLAGE` pour que ④j leur impose la même
  // exigence qu'aux vingt-sept autres : lire une SOURCE VIVANTE.
  'paroiAmbianteCoef',
  'paroiAmbianteIntensite',
  'albedoBase',
  'albedoTeinte',
  'paroiCouleur',
  'surfaceFx',
  'fxBlend',
  'fxOpacity',
  'fxScale',
  'fxColA',
  'fxColB',
  'fxColC',
  'fxP1',
  'fxP2',
  'fxP3',
  'fxDemiBloc',
  'fxFenetreX',
  'fxFenetreY',
]

test('④a les vingt-sept champs sont SURVEILLÉS, un par un', () => {
  for (const champ of CHAMPS_P3) assert.ok(CHAMPS_HABILLAGE.includes(champ), `${champ} absent`)
  // ⚠️ et chacun fait vraiment BASCULER la comparaison — une liste qu'on lit
  // sans l'exercer est une liste qu'on croit
  const pose = Object.fromEntries(CHAMPS_HABILLAGE.map((c) => [c, 1]))
  assert.equal(habillageDifferent(pose, { ...pose }), false)
  for (const champ of CHAMPS_P3) {
    assert.equal(habillageDifferent(pose, { ...pose, [champ]: 2 }), true, `${champ} n'est pas surveillé`)
  }
})

test('④b ⛔ fxTime N’EST PAS surveillé, et main.js le pousse par l’autre porte', () => {
  // ⚠️ Il avance à CHAQUE image : dans la liste, il reposerait l'habillage
  // entier — textures comprises — soixante fois par seconde.
  assert.equal(CHAMPS_HABILLAGE.includes('fxTime'), false)
  assert.match(MAIN_SRC, /globe\?\.poserTempsApparence\(terrain\.mapUniforms\.uFxTime\.value\)/)
})

test('④c contexteCrop lit les LAMPES et le MATÉRIAU, jamais params', () => {
  // ⚠️ **COMMENTAIRES RETIRÉS AVANT DE CHERCHER** : la Tâche K ter a trouvé une
  // assertion verte parce qu'elle lisait une formule DANS UN PAVÉ DE PROSE.
  const ctx = MAIN_SRC.slice(
    MAIN_SRC.indexOf('function contexteCrop()'),
    MAIN_SRC.indexOf('\nconst veilleCrop')
  ).replace(/\/\/[^\n]*/g, '')
  // le soleil : l'INTENSITÉ vient de la lampe (elle porte l'atténuation rasante
  // et l'interrupteur `sunOn`), les ANGLES viennent de params (seul écrivain)
  assert.match(ctx, /soleilIntensite: sun\.intensity/)
  assert.match(ctx, /soleilCouleur: `#\$\{sun\.color\.getHexString\(\)\}`/)
  assert.match(ctx, /soleilAzimut: params\.sunAzimuth/)
  assert.match(ctx, /soleilElevation: params\.sunElevation/)
  assert.match(ctx, /hemiCiel: `#\$\{hemi\.color\.getHexString\(\)\}`/)
  assert.match(ctx, /hemiSol: `#\$\{hemi\.groundColor\.getHexString\(\)\}`/)
  assert.match(ctx, /hemiIntensite: hemi\.intensity/)
  // ⛔ la paroi vient du MATÉRIAU, pas de `params.plinthColor` — relevé au même
  // instant : `params.plinthColor = #d8d4cc` et la paroi vivante `c06a44`
  assert.match(ctx, /paroiCouleur: `#\$\{plinth\.wallMat\.color\.getHexString\(\)\}`/)
  assert.equal(/paroiCouleur:\s*params\.plinthColor/.test(ctx), false)
  // l'ambiante est MESURÉE, et sur la seule intensité que three applique
  assert.match(ctx, /ambianteCoef: coefAmbiante\(renderer, scene\.environment\)/)
  assert.match(ctx, /ambianteIntensite: scene\.environmentIntensity/)
  // ⛔ **ET LA PAROI A LA SIENNE — Tâche P8.** `envMapIntensity` est du code
  // MORT sur le RELIEF (`terrain.material.envMap === null`, et `three` écrase
  // alors l'uniforme par `scene.environmentIntensity`) — la ligne ci-dessus le
  // garde. Mais la PAROI porte son propre `envMap` (`plinth.setEnvMap` ←
  // `makeSocleEnvMap`), donc pour elle c'est l'inverse : `envMapIntensity`
  // compte et `scene.environmentIntensity` est morte. Le crop prenait
  // l'ambiante du relief sur ses parois — **1,68 fois trop claires**.
  assert.equal(/ambianteIntensite:.*envMapIntensity/.test(ctx), false)
  assert.match(ctx, /paroiAmbianteCoef: coefAmbiante\(renderer, envParoi\.texture\)/)
  assert.match(ctx, /paroiAmbianteIntensite: envParoi\.intensite/)
  // ⚠️ **LA RÈGLE VIENT DU MODULE PUR, ET LE MATÉRIAU DIT LA VÉRITÉ** — même
  // règle que `paroiCouleur` : `params.envMapIntensity` vaut 0,15 pendant que
  // le matériau vivant porte 1 (un préréglage PBR le repose).
  assert.match(ctx, /environnementEffectif\(\s*plinth\?\.wallMat\?\.envMap \?\? null,\s*plinth\?\.wallMat\?\.envMapIntensity,/)
  assert.equal(/params\.envMapIntensity/.test(ctx), false)
  // la couche Apparence vient des uniformes du socle
  for (const u of ['uSurfaceFx', 'uFxBlend', 'uFxOpacity', 'uFxScale', 'uFxP1', 'uFxP2', 'uFxP3']) {
    assert.match(ctx, new RegExp(`terrain\\.mapUniforms\\.${u}\\.value`))
  }
  assert.match(ctx, /fxDemiBloc: terrain\.mapUniforms\.uSlabHalf/)
  // le lieu du crop, l'albédo et sa teinte — les trois que la campagne de
  // mutation a trouvés NON COUVERTS au premier tour (voir ④j)
  assert.match(ctx, /centreLat: centre\.lat/)
  assert.match(ctx, /centreLon: centre\.lon/)
  assert.match(ctx, /albedoBase: `#\$\{terrain\.material\.color\.getHexString\(\)\}`/)
  assert.match(ctx, /albedoTeinte: terrain\.mapUniforms\.uTint\.value/)
})

test('④j ⛔ CHAQUE champ surveillé lit une SOURCE VIVANTE — aucun ne peut être figé', () => {
  // ⛔ **CETTE ASSERTION EXISTE PARCE QUE LA CAMPAGNE DE MUTATION A TROUVÉ UN
  // TROU RÉEL.** Premier tour : **33 / 36**, et les trois survivantes étaient
  // `centreLat`, `albedoBase` et `albedoTeinte` figés à une constante dans
  // `contexteCrop`. Le ④c d'alors nommait quinze champs sur vingt-sept, et les
  // douze autres pouvaient être remplacés par un littéral sans qu'un test bouge.
  //
  // ⚠️ **ON N'ÉNUMÈRE PLUS À LA MAIN** : la liste vient de `CHAMPS_HABILLAGE`,
  // donc un champ ajouté demain est couvert dès son ajout — c'est la leçon que
  // `uHemi` a coûtée à la Tâche P2, dont le ④c ne vérifiait que trois curseurs
  // sur dix.
  const ctx = MAIN_SRC.slice(
    MAIN_SRC.indexOf('function contexteCrop()'),
    MAIN_SRC.indexOf('\nconst veilleCrop')
  ).replace(/\/\/[^\n]*/g, '')
  // une source vivante : un uniforme du socle, une lampe, la scène, le
  // matériau, le socle-plinthe, le centre du crop, ou la sonde d'ambiante.
  // ⚠️ `envParoi.` est vivant parce qu'il est BÂTI juste au-dessus depuis
  // `plinth?.wallMat` — c'est ④c qui garde CETTE ligne-là.
  const VIVANT = /^\s*(terrain\.|sun\.|hemi\.|scene\.|plinth\.|centre\.|coefAmbiante\(|envParoi\.|params\.sun|`#\$\{)/
  let n = 0
  for (const champ of CHAMPS_P3) {
    const m = ctx.match(new RegExp(`\\n\\s*${champ}:([^\\n]*)`))
    assert.ok(m, `${champ} n'est pas rempli par contexteCrop`)
    assert.match(m[1], VIVANT, `${champ} est figé : « ${m[1].trim()} »`)
    n++
  }
  assert.equal(n, CHAMPS_P3.length)
  assert.equal(n, 29) // le dénominateur est COMPTÉ, pas annoncé par le titre
})

test('④d poserHabillage POSE les uniformes, et retirerHabillage les REND', () => {
  const g = new Globe({ radius: 100 })
  const u = g.uniforms
  const depart = {
    eclairage: u.uEclairageOn.value,
    soleil: u.uSoleilIrr.value.toArray(),
    ciel: u.uCielIrr.value.toArray(),
    sol: u.uSolIrr.value.toArray(),
    // ⚠️ **LES DEUX DE LA PAROI — Tâche P8.** Sans eux, la mutation qui retire
    // leur remise à zéro de `retirerHabillage` SURVIT : elle l'a fait au premier
    // tour de la campagne.
    paroiCiel: u.uParoiCielIrr.value.toArray(),
    paroiSol: u.uParoiSolIrr.value.toArray(),
    base: u.uAlbedoBase.value.toArray(),
    teinte: u.uAlbedoTeinte.value,
    paroi: u.uParoiCouleur.value.getHexString(),
    fx: u.uSurfaceFx.value,
    fxOp: u.uFxOpacite.value,
  }
  assert.equal(depart.eclairage, 0) // ⚠️ la garde MONDE, comme uCropOn et uHabOn
  assert.equal(depart.fx, APPARENCE_MONDE.surfaceFx)

  g.poserHabillage({
    centreLat: -21.26,
    centreLon: 55.74,
    soleilAzimut: 302.1,
    soleilElevation: 34.26,
    soleilCouleur: '#fff7e6',
    soleilIntensite: 3.74,
    hemiCiel: '#85c2eb',
    hemiSol: '#4a3a2a',
    hemiIntensite: 0.81,
    ambianteCoef: { ciel: [2, 2, 2], sol: [0.4, 0.4, 0.4] },
    ambianteIntensite: 0.5,
    albedoBase: '#eef3f8',
    albedoTeinte: 0.68,
    paroiCouleur: '#c06a44',
    surfaceFx: 9,
    fxBlend: 2,
    fxOpacity: 0.44,
    fxScale: 1.5,
    fxColA: '#14161d',
    fxColB: '#c9885a',
    fxColC: '#000000',
    fxP1: 0.35,
    fxP2: 0.4,
    fxP3: 0.5,
    fxDemiBloc: 28,
    fxFenetreX: 3,
    fxFenetreY: -4,
  })
  assert.equal(u.uEclairageOn.value, 1)
  assert.equal(u.uParoiCouleur.value.getHexString(), 'c06a44')
  assert.equal(u.uSurfaceFx.value, 9)
  assert.equal(u.uFxBlend.value, 2)
  assert.equal(u.uFxOpacite.value, 0.44)
  assert.equal(u.uFxScale.value, 1.5)
  assert.equal(u.uFxColB.value.getHexString(), 'c9885a')
  assert.deepEqual(u.uFxFenetre.value.toArray(), [3, -4])
  assert.equal(u.uAlbedoTeinte.value, 0.68)
  // ⚠️ **L'IRRADIANCE PORTE L'INTENSITÉ**, comme `WebGLLights` la porte
  assert.ok(u.uSoleilIrr.value.x > 3.7 && u.uSoleilIrr.value.x <= 3.74)
  // ⚠️ **ET L'AMBIANTE S'AJOUTE À L'HÉMISPHÈRE, ELLE NE VIT PAS À CÔTÉ**
  assert.ok(u.uCielIrr.value.x > 1, 'le ciel porte l’ambiante mesurée')
  assert.ok(u.uSolIrr.value.x > 0.19, 'le sol porte l’ambiante mesurée')
  // ⚠️ **ET CE N'EST PAS UN BANC VIDE** : sans donnée de paroi, ses deux
  // uniformes portent le repli, c'est-à-dire ceux des tuiles — non nuls.
  assert.ok(u.uParoiCielIrr.value.x > 1, 'la paroi porte le repli, pas zéro')
  // la verticale locale et le soleil sont des vecteurs UNITAIRES
  assert.ok(Math.abs(u.uHemiHaut.value.length() - 1) < 1e-9)
  assert.ok(Math.abs(u.uSoleilDir.value.length() - 1) < 1e-9)

  g.retirerHabillage()
  assert.equal(u.uEclairageOn.value, depart.eclairage)
  assert.deepEqual(u.uSoleilIrr.value.toArray(), depart.soleil)
  assert.deepEqual(u.uCielIrr.value.toArray(), depart.ciel)
  assert.deepEqual(u.uSolIrr.value.toArray(), depart.sol)
  assert.deepEqual(u.uParoiCielIrr.value.toArray(), depart.paroiCiel)
  assert.deepEqual(u.uParoiSolIrr.value.toArray(), depart.paroiSol)
  assert.deepEqual(u.uAlbedoBase.value.toArray(), depart.base)
  assert.equal(u.uAlbedoTeinte.value, depart.teinte)
  assert.equal(u.uParoiCouleur.value.getHexString(), depart.paroi)
  assert.equal(u.uSurfaceFx.value, depart.fx)
  assert.equal(u.uFxOpacite.value, depart.fxOp)
})

test('④e SANS LIEU, PAS D’ÉCLAIRAGE — le repère est une dépendance', () => {
  // ⛔ L'azimut et l'élévation sont exprimés dans le repère du SOCLE. Sans la
  // latitude et la longitude du centre du crop, les replacer dans celui du
  // globe reviendrait à poser le soleil du golfe de Guinée sur La Réunion.
  const g = new Globe({ radius: 100 })
  g.poserHabillage({
    soleilAzimut: 302.1,
    soleilElevation: 34.26,
    soleilCouleur: '#fff7e6',
    soleilIntensite: 3.74,
    hemiCiel: '#85c2eb',
    hemiSol: '#4a3a2a',
    hemiIntensite: 0.81,
  })
  assert.equal(g.uniforms.uEclairageOn.value, 0)
})

test('④f poserTempsApparence pousse l’horloge, et refuse ce qui n’est pas un nombre', () => {
  const g = new Globe({ radius: 100 })
  g.poserTempsApparence(12.5)
  assert.equal(g.uniforms.uFxTime.value, 12.5)
  g.poserTempsApparence(undefined)
  assert.equal(g.uniforms.uFxTime.value, 12.5)
  g.poserTempsApparence(NaN)
  assert.equal(g.uniforms.uFxTime.value, 12.5)
})

test('④g la couleur des parois est PARTAGÉE avec le matériau, pas recopiée', () => {
  // ⚠️ Le matériau des parois est REFAIT à chaque reconstruction du solide ; une
  // couleur posée dessus se perdrait au prochain déplacement. Et la palette
  // change sans que les parois soient rebâties.
  const g = new Globe({ radius: 100 })
  const mat = g._materiauParois()
  assert.equal(mat.uniforms.uCol, g.uniforms.uParoiCouleur)
  g.poserHabillage({ paroiCouleur: '#123456' })
  assert.equal(mat.uniforms.uCol.value.getHexString(), '123456')
  assert.equal(/new THREE\.Color\('#d8d4cc'\) \}, \/\/ `params\.plinthColor`/.test(GLOBE_SRC), false)
})

test('④h le repère local : est / haut / nord, et les trois se vérifient', () => {
  // ⚠️ La correspondance se LIT dans le dépôt : `latLonToWorld` (x = est,
  // z = sud) et `latLonToSphere` (p = R·(cos φ sin λ, sin φ, cos φ cos λ)).
  const lat = -21.26
  const lon = 55.74
  const haut = hautLocal(lat, lon)
  assert.ok(Math.abs(Math.hypot(...haut) - 1) < 1e-12)
  // à l'équateur / méridien zéro, le haut est +Z
  assert.deepEqual(hautLocal(0, 0).map((v) => +v.toFixed(12)), [0, 0, 1])
  // un soleil au ZÉNITH pointe exactement vers le haut local, où qu'on soit
  for (const [la, lo] of [[0, 0], [45, 90], [-21.26, 55.74], [60, -120]]) {
    const s = directionSoleilLocale(0, 90, la, lo)
    const h = hautLocal(la, lo)
    for (let k = 0; k < 3; k++) assert.ok(Math.abs(s[k] - h[k]) < 1e-12, `${la},${lo}`)
  }
  // un soleil à l'HORIZON est perpendiculaire au haut local, à tout azimut
  for (const az of [0, 45, 90, 180, 302.1]) {
    const s = directionSoleilLocale(az, 0, lat, lon)
    const h = hautLocal(lat, lon)
    assert.ok(Math.abs(s[0] * h[0] + s[1] * h[1] + s[2] * h[2]) < 1e-12, `az=${az}`)
  }
  // et l'élévation est bien l'angle au plan horizontal
  for (const el of [10, 34.26, 70]) {
    const s = directionSoleilLocale(123, el, lat, lon)
    const h = hautLocal(lat, lon)
    const cos = s[0] * h[0] + s[1] * h[1] + s[2] * h[2]
    assert.ok(Math.abs(cos - Math.sin((el * Math.PI) / 180)) < 1e-12, `el=${el}`)
  }
})

test('④i irradianceAmbiante : UNE intensité, et zéro sans environnement', () => {
  // ⛔ La première version multipliait AUSSI par `material.envMapIntensity`
  // (0,15). `three` (`WebGLRenderer.js`) ÉCRASE cet uniforme par
  // `scene.environmentIntensity` quand le matériau n'a pas d'`envMap` à lui —
  // et `terrain.material.envMap === null`. C'était un facteur 6,7.
  const coef = { ciel: [2, 3, 4], sol: [0.2, 0.3, 0.4] }
  assert.deepEqual(irradianceAmbiante(coef, 0.5), { ciel: [1, 1.5, 2], sol: [0.1, 0.15, 0.2] })
  assert.deepEqual(irradianceAmbiante(null, 0.5), { ciel: [0, 0, 0], sol: [0, 0, 0] })
  assert.deepEqual(irradianceAmbiante(coef, 0), { ciel: [0, 0, 0], sol: [0, 0, 0] })
  assert.deepEqual(irradianceAmbiante(coef, NaN), { ciel: [0, 0, 0], sol: [0, 0, 0] })
  // ⚠️ et la source du coefficient est bien une MESURE, pas une constante
  const sonde = readFileSync(new URL('../src/sonde-ambiante.js', import.meta.url), 'utf8')
  assert.match(sonde, /readRenderTargetPixels/)
  assert.match(sonde, /shadowMap\.needsUpdate/) // sauvé et reposé
  assert.match(MAIN_SRC, /import \{ coefAmbiante \} from '\.\/sonde-ambiante\.js'/)
})

// ══════════ ⑤ LES GARDES DU NUANCEUR, ÉVALUÉES ═════════════════════════════

test('⑤a les uniformes que FX_GLSL LIT sont tous déclarés dans le fragment', () => {
  // ⚠️ Le module ne déclare AUCUN uniforme : son en-tête dit que l'hôte doit le
  // faire. Un oubli ne se voit qu'à la compilation du nuanceur, sur le GPU.
  for (const u of ['uFxScale', 'uFxTime', 'uFxColA', 'uFxColB', 'uFxColC', 'uFxP1', 'uFxP2', 'uFxP3']) {
    assert.match(FRAG_NU, new RegExp(`uniform (?:float|vec3) ${u};`), `${u} non déclaré`)
  }
  for (const u of ['uSurfaceFx', 'uFxBlend']) assert.match(FRAG_NU, new RegExp(`uniform int ${u};`))
  for (const u of ['uEclairageOn', 'uFxOpacite', 'uFxDemiBloc', 'uAlbedoTeinte']) {
    assert.match(FRAG_NU, new RegExp(`uniform float ${u};`))
  }
  for (const u of ['uSoleilDir', 'uSoleilIrr', 'uHemiHaut', 'uCielIrr', 'uSolIrr', 'uAlbedoBase']) {
    assert.match(FRAG_NU, new RegExp(`uniform vec3 ${u};`))
  }
  assert.match(FRAG_NU, /uniform vec2 uFxFenetre;/)
})

test('⑤b l’ordre d’injection est celui que les dépendances imposent', () => {
  // `natSoftLight` (GLSL_NATUREL) est appelé par `fxBlend` (GLSL_MELANGE) ;
  // `natLuminance` (GLSL_NATUREL) par `albedoCrop` (GLSL_ECLAIRAGE) ;
  // et FX_GLSL lit des uniformes qui doivent être déclarés avant lui.
  const iNat = FRAG_NU.indexOf('${GLSL_NATUREL}')
  const iEcl = FRAG_NU.indexOf('${GLSL_ECLAIRAGE}')
  const iFx = FRAG_NU.indexOf('${FX_GLSL}')
  const iMel = FRAG_NU.indexOf('${GLSL_MELANGE}')
  const iUni = FRAG_NU.indexOf('uniform float uFxScale;')
  assert.ok(iNat > 0 && iEcl > iNat, 'GLSL_ECLAIRAGE après GLSL_NATUREL')
  assert.ok(iMel > iNat, 'GLSL_MELANGE après GLSL_NATUREL')
  assert.ok(iFx > iUni && iUni > 0, 'FX_GLSL après ses uniformes')
  // côté socle, la même contrainte
  assert.ok(TERRAIN_NU.indexOf('${GLSL_MELANGE}') > TERRAIN_NU.indexOf('${GLSL_NATUREL}'))
})

test('⑤c la garde est un UNIFORME, et à zéro le bloc n’existe pas', () => {
  // ⚠️ `partBloc` est le SEUL chemin vers l'éclairage, l'albédo et l'apparence.
  // Sa définition doit le rendre nul quand `uEclairageOn` vaut 0 — c'est ce qui
  // garantit la production intouchée au bit près.
  assert.match(FRAG_NU, /float partBloc = uEclairageOn > 0\.5 \? dedansCrop : 0\.0;/)
  assert.match(FRAG_NU, /if \(partBloc > 0\.0\) \{/)
  assert.match(FRAG_NU, /uFxOpacite > 0\.001 && partBloc > 0\.0/)
  assert.match(FRAG_NU, /col = mix\(colPlanete, colBloc, partBloc\);/)
  // et la loi de PLANÈTE est intacte, dans son ordre d'origine
  assert.match(FRAG_NU, /vec3 colPlanete = col \* \(0\.74 \+ 0\.30 \* diff\);/)
  // ⚠️ **LE PLANCHER EST UN UNIFORME DEPUIS LA TÂCHE R7** (tour de correction) :
  // `uNuitCarte + (1.0 - uNuitCarte) * day` avec `uNuitCarte = 0,10` EST
  // `0,10 + 0,90 * day` — en float32 `1 - 0,1f == 0,9f` — et `uNuitFond` vaut
  // alors exactement `uShadowColor`. La loi de planète est donc toujours
  // intacte AU BIT PRÈS en production ; seul le drapeau `soleilHeureMonde` la
  // relève, parce que le correctif met la face nuit en plein cadre.
  assert.match(FRAG_NU, /colPlanete = mix\(uNuitFond, colPlanete, uNuitCarte \+ \(1\.0 - uNuitCarte\) \* day\);/)
})

test('⑤d dedansCrop est la SUPERELLIPSE, pas le carré de l’analyse', () => {
  // ⛔ Le carré `dansCrop` borne la TEXTURE d'analyse ; la silhouette du bloc
  // est la superellipse `dedans`, celle que les parois suivent au bit près.
  assert.match(FRAG_NU, /float dedansCrop = 0\.0;/)
  assert.match(FRAG_NU, /dedansCrop = dedans;/)
  const iDedans = FRAG_NU.indexOf('float dedans = 1.0 - smoothstep')
  const iPose = FRAG_NU.indexOf('dedansCrop = dedans;')
  assert.ok(iDedans > 0 && iPose > iDedans)
})

test('⑤e l’albédo est fabriqué AVANT l’apparence et les traits de carte', () => {
  // ⚠️ `terrain.js` mélange la peinture dans `diffuseColor` AVANT l'apparence,
  // le trait de côte, les courbes et le graticule. Poser le mélange après eux
  // fait repasser le motif dans `mix(fond, x, teinte)` : mesuré, l'apparence
  // n'assombrissait plus le crop qu'à 0,73 contre 0,58 pour le socle.
  const iAlbedo = FRAG_NU.indexOf('albedoCrop(col, uAlbedoBase')
  const iFx = FRAG_NU.indexOf('fxBlend(col, fxc, uFxBlend)')
  const iCote = FRAG_NU.indexOf('col = mix(col, uInk, cote * 0.55);')
  const iContour = FRAG_NU.indexOf('col = mix(col, uInk, contour);')
  const iLumiere = FRAG_NU.indexOf('vec3 colBloc = col * irradianceCrop(')
  assert.ok(iAlbedo > 0 && iFx > iAlbedo, 'l’apparence peint sur l’albédo')
  assert.ok(iCote > iFx, 'le trait de côte passe APRÈS l’apparence')
  assert.ok(iContour > iCote, 'les courbes passent après le trait de côte')
  assert.ok(iLumiere > iContour, 'la lumière multiplie en DERNIER')
})

test('⑤f le compte de samplers ne bouge pas — huit, pour un plafond de seize', () => {
  // ⚠️ Cette tâche n'ajoute AUCUNE texture : que des uniformes scalaires et
  // vectoriels. Le pavé de `globe.js` qui annonce huit doit rester vrai, et
  // c'est la boucle qui compte, pas le commentaire.
  const n = (FRAG_NU.match(/uniform sampler2D /g) || []).length
  assert.equal(n, 8)
})

test('⑤g les défauts MONDE sont ceux des modules, pas des nombres recopiés', () => {
  const g = new Globe({ radius: 100 })
  const u = g.uniforms
  assert.deepEqual(u.uSoleilIrr.value.toArray(), [...ECLAIRAGE_MONDE.soleilIrr])
  assert.deepEqual(u.uCielIrr.value.toArray(), [...ECLAIRAGE_MONDE.cielIrr])
  assert.deepEqual(u.uSolIrr.value.toArray(), [...ECLAIRAGE_MONDE.solIrr])
  assert.deepEqual(u.uAlbedoBase.value.toArray(), [...ECLAIRAGE_MONDE.albedoBase])
  assert.equal(u.uAlbedoTeinte.value, ECLAIRAGE_MONDE.albedoTeinte)
  assert.equal(u.uSurfaceFx.value, APPARENCE_MONDE.surfaceFx)
  assert.equal(u.uFxOpacite.value, APPARENCE_MONDE.fxOpacity)
  assert.equal(u.uFxDemiBloc.value, APPARENCE_MONDE.fxDemiBloc)
  // ⚠️ et le défaut de l'apparence est ÉTEINT : sans lui, toutes les tuiles du
  // globe — y compris celles qui ne verront jamais de crop — porteraient un
  // motif de bloc.
  assert.equal(APPARENCE_MONDE.surfaceFx, 0)
  assert.equal(APPARENCE_MONDE.fxOpacity, 0)
  assert.equal(ECLAIRAGE_MONDE.albedoTeinte, 1)
})

// ══════════ ⑥ LES PAROIS SONT ÉCLAIRÉES COMME LES TUILES — Tâche P6 ════════
//
// ⛔ **P3 A ÉCLAIRÉ LES TUILES ET A LAISSÉ LES PAROIS SUR LE SOLEIL DE LA
// PLANÈTE, C'EST-À-DIRE SUR LA CAMÉRA.** Elle l'écrit noir sur blanc pour les
// tuiles — *« uSunDir n'est pas le soleil de la scène : en mode surface,
// main.js le repose À CHAQUE IMAGE sur camGlobe.position tournée de 42 degrés »*
// — et n'a pas refait le geste sur `_materiauParois`. Relevé le 2026-08-22 au
// même instant dans la même page : `uSunDir = (0,2305 · −0,3687 · 0,9005)`,
// **sous l'horizon**, contre `(0,4392 · 0,5629 · −0,7001)` pour le soleil de la
// scène, et `uShadowColor = #c8a881`, **un beige**. Un flanc que ce faux soleil
// laisse à `day ≈ 0` rendait donc **exactement `uShadowColor`** : c'est le grand
// aplat beige de la réserve n° 1 de P5, et ce n'était pas une paroi éclairée.
//
// ⚠️ **CES SIX TESTS SONT NÉS D'UNE CAMPAGNE DE MUTATION.** Premier tour de P6 :
// **60 / 72**, et CINQ des onze survivantes visaient ce seul nuanceur — il
// n'était gardé par rien du tout. On EXÉCUTE ce qui s'exécute (l'identité des
// uniformes partagés) et on DÉCLARE ce qui ne s'exécute pas (le texte GLSL).

test('⑥a `_materiauParois` PARTAGE les uniformes du bloc — pas des copies', () => {
  const g = new Globe({ radius: 100 })
  const m = g._materiauParois()
  // ⚠️ **PARTAGÉS, ET C'EST CE QUI FAIT QUE LA TIRETTE D'HEURE LES DÉPLACE.**
  // `poserHabillage` écrit dans `this.uniforms` ; les parois ne sont rebâties
  // qu'à l'arrêt. Des copies figeraient leur soleil à la naissance du bloc.
  for (const nom of ['uSoleilDir', 'uHemiHaut', 'uSoleilIrr', 'uEclairageOn']) {
    assert.equal(m.uniforms[nom], g.uniforms[nom], `${nom} doit être PARTAGÉ avec les tuiles`)
  }
  // ⛔ **MAIS PAS L'AMBIANTE, ET C'EST LE MANQUE N° 3 DU NOTEUR — Tâche P8.**
  // Le relief du socle voit `scene.environment` à `scene.environmentIntensity` ;
  // sa PAROI voit son propre `wallMat.envMap` à `envMapIntensity`, parce que
  // `three` n'écrase l'intensité que sur les matériaux SANS `envMap` à eux.
  // Mesuré au même instant dans la même page : l'ambiante du relief verse
  // **1,54 fois** celle de la paroi à plat sur un mur vertical, et la paroi du
  // crop prenait la première — **26,63 contre 15,88 au socle**.
  // ⚠️ **ILS EXISTENT, D'ABORD.** Sans cette ligne, retirer purement et
  // simplement les deux uniformes du constructeur laisse `undefined === undefined`
  // et la mutation survit — elle l'a fait au premier tour de la campagne.
  assert.ok(m.uniforms.uCielIrr && m.uniforms.uCielIrr.value, 'uCielIrr doit exister')
  assert.ok(m.uniforms.uSolIrr && m.uniforms.uSolIrr.value, 'uSolIrr doit exister')
  assert.equal(m.uniforms.uCielIrr, g.uniforms.uParoiCielIrr, 'la paroi lit SON ciel')
  assert.equal(m.uniforms.uSolIrr, g.uniforms.uParoiSolIrr, 'la paroi lit SON sol')
  assert.notEqual(m.uniforms.uCielIrr, g.uniforms.uCielIrr, 'la paroi ne lit PAS le ciel des tuiles')
  assert.notEqual(m.uniforms.uSolIrr, g.uniforms.uSolIrr, 'la paroi ne lit PAS le sol des tuiles')
  // les trois d'avant P6 le restent — le repli de planète existe encore
  for (const nom of ['uSunDir', 'uShadowColor']) {
    assert.equal(m.uniforms[nom], g.uniforms[nom], `${nom} doit rester partagé`)
  }
  assert.equal(m.uniforms.uCol, g.uniforms.uParoiCouleur, 'la couleur de paroi vit dans this.uniforms')
  // ⚠️ **LE TÉMOIN** : un uniforme qui n'a rien à faire là ne doit PAS être
  // partagé, sinon la boucle ci-dessus passerait sur n'importe quel matériau.
  assert.equal(m.uniforms.uRamp, undefined)
})

test('⑥b le nuanceur des parois porte la loi d IRRADIANCE, et son albédo est couleur × occlusion', () => {
  // ⚠️ **ASSERTION DE SOURCE, DÉCLARÉE TELLE** : ce nuanceur ne se compile pas
  // sous node. Ce qu'elle garde est la STRUCTURE de la loi, pas une valeur.
  const i = GLOBE_SRC.indexOf('_materiauParois() {')
  assert.ok(i > 0, '_materiauParois doit rester lisible')
  const bloc = GLOBE_SRC.slice(i, GLOBE_SRC.indexOf('\n  /**', i)).replace(/\/\/[^\n]*/g, '')
  // l'albédo : la couleur de paroi FOIS l'occlusion de contact par sommet —
  // c'est ce que le socle fait avec `material.color` et son attribut `color`.
  assert.match(bloc, /vec3 colBloc = uCol \* vAo/)
  // l'irradiance : la MÊME fonction que les tuiles, avec les MÊMES cinq entrées
  assert.match(bloc, /irradianceCrop\(dot\(N, uSoleilDir\), dot\(N, uHemiHaut\), uSoleilIrr, uCielIrr, uSolIrr\)/)
  // …et son 1 / π, interpolé depuis le module et non écrit à la main
  assert.match(bloc, /\* \$\{RECIPROQUE_PI\};/)
  // ⛔ **ET LE TERMINATEUR NE FRANCHIT PAS LA FRONTIÈRE DU BLOC** — P3 le dit
  // déjà pour les tuiles : « le socle n'a pas de nuit, c'est un objet de studio ».
  assert.match(bloc, /gl_FragColor = vec4\(uEclairageOn > 0\.5 \? colBloc : colPlanete, 1\.0\);/)
  // le repli de planète reste, AU BIT PRÈS : c'est lui qu'un globe sans crop rend
  assert.match(bloc, /vec3 colPlanete = uCol \* \(0\.74 \+ 0\.30 \* diff\) \* vAo;/)
  // ⚠️ **LE PLANCHER EST UN UNIFORME DEPUIS LA TÂCHE R7** (tour de correction) :
  // `uNuitCarte + (1.0 - uNuitCarte) * day` avec `uNuitCarte = 0,10` EST
  // `0,10 + 0,90 * day` — en float32 `1 - 0,1f == 0,9f` — et `uNuitFond` vaut
  // alors exactement `uShadowColor`. La loi de planète est donc toujours
  // intacte AU BIT PRÈS en production ; seul le drapeau `soleilHeureMonde` la
  // relève, parce que le correctif met la face nuit en plein cadre.
  assert.match(bloc, /colPlanete = mix\(uNuitFond, colPlanete, uNuitCarte \+ \(1\.0 - uNuitCarte\) \* day\);/)
})

test('⑥c `GLSL_IRRADIANCE` est INJECTÉ dans `GLSL_ECLAIRAGE`, jamais réécrit', () => {
  // ⛔ **DEUX ÉCRITURES DE LA MÊME LOI, C'EST LA FAUTE QUE D13 §③ NOMME**, et ce
  // chantier l'a déjà payée sur `blLum`, sur l'écume et sur `chopLook`. Le
  // morceau est détaché parce que le nuanceur des parois est NU — ni rampe, ni
  // peinture, donc pas de `natLuminance` dont `GLSL_ECLAIRAGE` dépend.
  const src = readFileSync(new URL('../src/monde/eclairage-crop.js', import.meta.url), 'utf8')
  assert.match(src, /\$\{GLSL_IRRADIANCE\}\nvec3 eclairerCrop/)
  // une seule écriture du corps, dans le morceau détaché
  const nCorps = (src.match(/soleil \* max\(ndl, 0\.0\) \+ mix\(sol, ciel, 0\.5 \* ndu \+ 0\.5\)/g) || []).length
  assert.equal(nCorps, 1, `la loi doit être écrite UNE fois, pas ${nCorps}`)
  // …et le texte assemblé la porte quand même
  assert.match(GLSL_ECLAIRAGE, /vec3 irradianceCrop\(float ndl, float ndu, vec3 soleil, vec3 ciel, vec3 sol\)/)
  // ⚠️ **ET LE GLOBE INJECTE LE MORCEAU DÉTACHÉ DANS LES PAROIS**, une fois.
  assert.equal((GLOBE_NU.match(/\$\{GLSL_IRRADIANCE\}/g) || []).length, 1)
  assert.match(GLOBE_NU, /GLSL_IRRADIANCE,/)
})

// ══════════ ⑦ L'AMBIANTE DE LA PAROI N'EST PAS CELLE DU RELIEF — Tâche P8 ═══
//
// ⛔ **LE MANQUE N° 3 DU NOTEUR TENAIT DANS UNE MOITIÉ DE LIGNE DE `three`.**
// `sonde-ambiante.js` la cite depuis P3 :
//
//     if ( material.isMeshStandardMaterial && material.envMap === null
//          && scene.environment !== null )
//         m_uniforms.envMapIntensity.value = scene.environmentIntensity;
//
// et en tire, à raison, qu'`envMapIntensity` est du code MORT sur le relief.
// **L'autre moitié n'avait jamais été tirée** : la PAROI du socle porte son
// propre `envMap` (`plinth.setEnvMap(makeSocleEnvMap(renderer))`, une pièce
// SOMBRE à fond `0x15171d` et sol noir), donc pour elle la règle s'inverse.
//
// ⚡ **LES DEUX AMBIANTES, MESURÉES AU MÊME INSTANT DANS LA PAGE VIVANTE**
// (`.banc/P8/S3-ambiante-P8.json`), à plat sur un mur vertical :
// relief **(1,526 · 1,526 · 1,526)** contre paroi **(0,989 · 0,947 · 0,931)**.
// La paroi du crop prenait la première : **26,63 contre 15,88 au socle**.

test('⑦a `environnementEffectif` applique la règle de three, pas une commodité', () => {
  const propre = { nom: 'studio' }
  const scene = { nom: 'salle' }
  // ⛔ un matériau qui a SON `envMap` ne voit NI la texture de scène NI son
  // intensité — c'est le cas de la paroi du socle
  assert.deepEqual(environnementEffectif(propre, 1, scene, 0.395), { texture: propre, intensite: 1 })
  assert.deepEqual(environnementEffectif(propre, 1.4, scene, 0.395), { texture: propre, intensite: 1.4 })
  // … et un matériau SANS `envMap` voit celle de la scène, à l'intensité de la
  // scène : c'est le cas du relief, et c'est ce que P3 avait déjà mesuré
  assert.deepEqual(environnementEffectif(null, 0.15, scene, 0.395), { texture: scene, intensite: 0.395 })
  // ⚠️ **LE TÉMOIN QUI TUE LA MUTATION « on prend toujours la scène »** : les
  // deux appels ci-dessous rendent des textures DIFFÉRENTES pour la même scène.
  assert.notEqual(
    environnementEffectif(propre, 1, scene, 0.395).texture,
    environnementEffectif(null, 1, scene, 0.395).texture
  )
  // rien du tout : pas de lumière, et surtout pas une intensité qui traîne
  assert.deepEqual(environnementEffectif(null, 1, null, 0.395), { texture: null, intensite: 0 })
  // une intensité absente ou aberrante ne fabrique pas un `NaN` d'irradiance
  assert.deepEqual(environnementEffectif(propre, undefined, scene, 0.4), { texture: propre, intensite: 1 })
  assert.deepEqual(environnementEffectif(propre, NaN, scene, 0.4), { texture: propre, intensite: 1 })
  assert.deepEqual(environnementEffectif(propre, -3, scene, 0.4), { texture: propre, intensite: 0 })
  assert.deepEqual(environnementEffectif(null, 1, scene, undefined), { texture: scene, intensite: 1 })
})

test('⑦b la paroi prend SON ambiante, les tuiles gardent la LEUR', () => {
  const g = new Globe({ radius: 100 })
  const u = g.uniforms
  const commun = {
    centreLat: -21.115, centreLon: 55.536, soleilAzimut: 302.02, soleilElevation: 34.33,
    soleilCouleur: '#fff7e6', soleilIntensite: 3.743,
    hemiCiel: '#85c2eb', hemiSol: '#4a3a2a', hemiIntensite: 0.8105,
  }
  // les DEUX coefficients RÉELS, relevés par la sonde du dépôt le 2026-08-22
  const RELIEF = { ciel: [6.6827, 6.6827, 6.6827], sol: [1.0452, 1.0452, 1.0452] }
  const PAROI = { ciel: [1.8348, 1.7796, 1.7636], sol: [0.1436, 0.1137, 0.0987] }
  g.poserHabillage({
    ...commun,
    ambianteCoef: RELIEF, ambianteIntensite: 0.3951,
    paroiAmbianteCoef: PAROI, paroiAmbianteIntensite: 1,
  })
  // ⚠️ **LA LAMPE HÉMISPHÉRIQUE EST LA MÊME DES DEUX CÔTÉS** — elle éclaire
  // toute la scène ; seul l'environnement diffère. On vérifie donc l'ÉCART, qui
  // doit valoir exactement la différence des deux ambiantes.
  const ecartCiel = u.uCielIrr.value.x - u.uParoiCielIrr.value.x
  assert.ok(Math.abs(ecartCiel - (6.6827 * 0.3951 - 1.8348)) < 1e-6, 'ecart ciel ' + ecartCiel)
  const ecartSol = u.uSolIrr.value.x - u.uParoiSolIrr.value.x
  assert.ok(Math.abs(ecartSol - (1.0452 * 0.3951 - 0.1436)) < 1e-6, 'ecart sol ' + ecartSol)
  // ⛔ **ET LE SENS COMPTE** : c'est le relief qui est le PLUS clair à plat sur
  // un mur vertical (1,526 contre 0,989 mesuré), donc la paroi doit être PLUS
  // SOMBRE. Une mutation qui échangerait les deux passerait l'égalité ci-dessus
  // au signe près ; elle ne passe pas celle-ci.
  const platTuiles = (u.uCielIrr.value.x + u.uSolIrr.value.x) / 2
  const platParoi = (u.uParoiCielIrr.value.x + u.uParoiSolIrr.value.x) / 2
  assert.ok(platParoi < platTuiles, 'la paroi doit etre plus sombre que les tuiles')
  assert.ok(platTuiles / platParoi > 1.3, 'rapport mesure 1,54 ; ici ' + platTuiles / platParoi)
  // ⚡ **ET LE MATÉRIAU DE PAROI LIT BIEN CES DEUX-LÀ** (⑥a garde l'identité ;
  // ici on garde la VALEUR, donc le chemin entier de `poserHabillage` au GPU)
  const m = g._materiauParois()
  assert.equal(m.uniforms.uCielIrr.value.x, u.uParoiCielIrr.value.x)
  assert.notEqual(m.uniforms.uCielIrr.value.x, u.uCielIrr.value.x)
})

test('⑦c SANS donnée de paroi, la paroi retombe sur les tuiles — AU BIT PRÈS', () => {
  // ⚠️ **L'INTERRUPTEUR EST L'ABSENCE DE DONNÉE**, le patron de `uCropOn`,
  // `uHabOn`, `coastMask` et `sol`. Un appelant qui ne connaît pas encore ces
  // deux champs doit rendre l'image d'AVANT la Tâche P8, pas une paroi noire.
  const g = new Globe({ radius: 100 })
  const u = g.uniforms
  const base = {
    centreLat: -21.115, centreLon: 55.536, soleilAzimut: 302.02, soleilElevation: 34.33,
    soleilCouleur: '#fff7e6', soleilIntensite: 3.743,
    hemiCiel: '#85c2eb', hemiSol: '#4a3a2a', hemiIntensite: 0.8105,
    ambianteCoef: { ciel: [6.6827, 6.6827, 6.6827], sol: [1.0452, 1.0452, 1.0452] },
    ambianteIntensite: 0.3951,
  }
  g.poserHabillage({ ...base })
  assert.deepEqual(u.uParoiCielIrr.value.toArray(), u.uCielIrr.value.toArray())
  assert.deepEqual(u.uParoiSolIrr.value.toArray(), u.uSolIrr.value.toArray())
  // ⚠️ **ET CE N'EST PAS UN BANC VIDE** : les valeurs ne sont ni nulles ni le
  // défaut MONDE — sans ça, l'égalité ci-dessus serait « zéro égale zéro ».
  assert.ok(u.uParoiCielIrr.value.x > 2, 'le repli porte une vraie irradiance')
  assert.notDeepEqual(u.uParoiCielIrr.value.toArray(), [...ECLAIRAGE_MONDE.cielIrr])
  // … et une ambiante de paroi NULLE n'est PAS le repli : un matériau dont
  // l'environnement a été retiré doit garder sa seule lampe hémisphérique.
  g.poserHabillage({ ...base, paroiAmbianteCoef: null, paroiAmbianteIntensite: 0 })
  assert.ok(u.uParoiCielIrr.value.x < u.uCielIrr.value.x, 'ambiante nulle, pas repli')
  assert.ok(u.uParoiCielIrr.value.x > 0.18, 'la lampe hemispherique reste')
})

// ══════════ ⑧ LA NORMALE PAR FRAGMENT — Tâche P9, RÉÉCRITE PAR P10 ══════════
//
// ⛔ **P9 AVAIT LIVRÉ LA LOI DE MIKKELSEN, ET ELLE A ÉTÉ RETIRÉE.** Elle
// reconstruisait la normale depuis `dFdx(h)` / `dFdy(h)` — une différence finie
// prise sur le VOISIN D'ÉCRAN, donc sur un voisin qui change avec la parité du
// quad 2 × 2. Le noteur l'a mesuré (`notation-03.md` §4) : un décalage de caméra
// d'UN pixel laissait **10,872 octets de résidu contre 0,030 au socle**, et
// **38,49 % des pixels de surface** bougeaient de plus de 8 octets. Aux
// décalages PAIRS, qui conservent la parité, le résidu retombait à **0,800**.
//
// La loi livrée par P10 est le champ de hauteur posé sur le plan tangent :
// `N = normalize(haut − gEst·est − gNord·nord)`, avec un repère qui vient de
// l'attribut `latlon` et deux pentes qui viennent de quatre lectures de texture.
//
// ⚠️ **CE QUE CE BLOC VÉRIFIE, ET DANS QUEL ORDRE** :
//   ⑧a la loi PURE, contre un oracle INDÉPENDANT — la surface est construite
//      point par point et sa normale obtenue par un vrai produit vectoriel de
//      différences finies. Le jumeau JS n'est donc pas comparé à lui-même ;
//   ⑧b ⚡ **LA RÉDUCTION** : la loi livrée EST celle de Mikkelsen nourrie d'un
//      repère orthonormé. L'écriture de P9 survit ici, comme SECOND oracle, et
//      les deux doivent rendre le même vecteur au 1e−12 ;
//   ⑧c la RÉFÉRENCE, LUE DANS `node_modules/three` : l'oracle de ⑧b est bien la
//      formule de `three`, terme à terme, et pas notre souvenir d'elle ;
//   ⑧d le REPÈRE DE SOL, contre `latLonToSphere` du dépôt, et la
//      TRANSCRIPTION GLSL des deux lois, sur le texte SANS SES COMMENTAIRES ;
//   ⑧e le BRANCHEMENT dans le nuanceur — la faiblesse récurrente du chantier —
//      et ⚡ **l'absence de TOUTE dérivée d'écran dans le bloc**, qui est la
//      seule chose que node puisse dire de l'invariance par translation ;
//   ⑧f le BRANCHEMENT dans la chaîne : `poserHabillage`, `retirerHabillage`,
//      `CHAMPS_HABILLAGE`, `contexteCrop` et `setExaggeration`.

/** Le produit vectoriel et le produit scalaire, une fois pour tout ce bloc. */
const CROIX = (a, b) => [a[1] * b[2] - a[2] * b[1], a[2] * b[0] - a[0] * b[2], a[0] * b[1] - a[1] * b[0]]
const NORME = (v) => Math.hypot(v[0], v[1], v[2])
const UNITE = (v) => { const l = NORME(v); return [v[0] / l, v[1] / l, v[2] / l] }
const POINT = (a, b) => a[0] * b[0] + a[1] * b[1] + a[2] * b[2]

/**
 * L'ORACLE INDÉPENDANT — il ne connaît pas `normaleParGradientSol`.
 *
 * On CONSTRUIT trois points de la surface — l'origine, un pas vers l'est, un pas
 * vers le nord, chacun remonté de la hauteur que la pente y donne — et on prend
 * le produit vectoriel des deux différences. C'est la DÉFINITION d'une normale,
 * pas une formule.
 */
function normaleOracle(gEst, gNord, est, nord, haut) {
  const p = (a, b) => [
    est[0] * a + nord[0] * b + haut[0] * (gEst * a + gNord * b),
    est[1] * a + nord[1] * b + haut[1] * (gEst * a + gNord * b),
    est[2] * a + nord[2] * b + haut[2] * (gEst * a + gNord * b),
  ]
  const c = CROIX(p(1, 0), p(0, 1))
  const s = POINT(c, haut) >= 0 ? 1 : -1
  return UNITE([c[0] * s, c[1] * s, c[2] * s])
}

/**
 * ⚡ **LE SECOND ORACLE : L'ÉCRITURE DE P9, MOT POUR MOT.**
 *
 * ⚠️ **ELLE NE VIT PLUS QUE DANS CE FICHIER, ET C'EST VOULU.** La loi de
 * Mikkelsen a quitté `src/` avec la Tâche P10 — ⑧c prouve juste en dessous que
 * cette transcription est bien celle de `three` — mais elle reste le meilleur
 * témoin que la nouvelle loi n'a rien changé à la GÉOMÉTRIE : la nouvelle est
 * l'ancienne, nourrie d'un paramétrage orthonormé.
 */
function normaleMikkelsen(sx, sy, n, dhx, dhy) {
  const r1 = CROIX(sy, n)
  const r2 = CROIX(n, sx)
  const det = POINT(sx, r1)
  const s = det < 0 ? -1 : det > 0 ? 1 : 0
  const v = [
    Math.abs(det) * n[0] - s * (dhx * r1[0] + dhy * r2[0]),
    Math.abs(det) * n[1] - s * (dhx * r1[1] + dhy * r2[1]),
    Math.abs(det) * n[2] - s * (dhx * r1[2] + dhy * r2[2]),
  ]
  const l = NORME(v)
  if (!(l > 0)) return [n[0], n[1], n[2]]
  return [v[0] / l, v[1] / l, v[2] / l]
}

/** Quelques repères de sol RÉELS, pris sur la sphère du globe. */
const LIEUX = [
  [-21.115, 55.536], // La Réunion, le cadrage intérieur de la notation
  [-21.05, 55.25], // La Réunion, le cadrage côte
  [0, 0], // le point origine — là où sin/cos sont dégénérés
  [45.83, 6.865], // le Mont-Blanc
  [-33.9, 151.2], // l'antipode de longitude
  [78.2, -15.6], // haute latitude, longitude négative
]

test('⑧a la normale par gradient suit la DÉFINITION — oracle indépendant', () => {
  const { est, nord, haut } = repereSolSphere(-21.115, 55.536)
  // ① gradient nul : la normale EST la verticale, au bit près.
  assert.deepEqual(normaleParGradientSol(0, 0, est, nord, haut), UNITE(haut))
  // ② un cas à la main, vérifiable de tête : pente 1/2 vers l'est, repère canonique.
  const n2 = normaleParGradientSol(0.5, 0, [1, 0, 0], [0, 0, -1], [0, 1, 0])
  const attendu = UNITE([-0.5, 1, 0])
  for (let i = 0; i < 3; i++) assert.ok(Math.abs(n2[i] - attendu[i]) < 1e-12, `${n2} contre ${attendu}`)
  // ⚠️ **ET LE SENS EST LE BON** : le sol MONTE vers l'est, donc la normale se
  // penche vers l'OUEST. Une mutation de signe passerait l'égalité de norme.
  assert.ok(n2[0] < 0, 'la normale se penche du mauvais cote')
  // ③ ⚡ **LE BALAYAGE CONTRE L'ORACLE**, sur des repères de sol RÉELS et des
  // pentes qui vont de la plaine à la falaise.
  let compares = 0
  for (const [lat, lon] of LIEUX) {
    const r = repereSolSphere(lat, lon)
    for (const t of balayage(11)) {
      const gE = (t - 0.5) * 4.2
      const gN = (0.5 - t) * 1.7
      const a = normaleParGradientSol(gE, gN, r.est, r.nord, r.haut)
      const o = normaleOracle(gE, gN, r.est, r.nord, r.haut)
      for (let i = 0; i < 3; i++) assert.ok(Math.abs(a[i] - o[i]) < 1e-9, `${a} contre l'oracle ${o}`)
      compares++
    }
  }
  assert.ok(compares >= 60, `banc vide : ${compares} comparaisons`)
  // ④ ⛔ **LE CAS DÉGÉNÉRÉ, ET LA PREMIÈRE ÉCRITURE DE CE TEST ÉTAIT UNE
  // TAUTOLOGIE — c'est une MUTATION SURVIVANTE qui l'a dit.** Elle appelait la
  // loi avec `haut = [0, 0, 0]` : les DEUX branches rendent alors le même
  // vecteur nul, donc « rendre `haut` » et « rendre zéro » étaient
  // indistinguables. Le vrai dégénéré demande un repère où la soustraction
  // s'annule — `est` COLINÉAIRE à `haut`, avec une pente de 1.
  const versLeHaut = [0, 1, 0]
  assert.deepEqual(normaleParGradientSol(1, 0, versLeHaut, [0, 0, 1], versLeHaut), versLeHaut,
    'le degenere rend un vecteur nul : un NaN plus loin, donc un trou noir')
  // ⚡ **ET VOICI POURQUOI LE NUANCEUR NE PEUT PAS Y TOMBER, PAR L'ALGÈBRE** :
  // le repère qu'il passe est ORTHONORMÉ (il ré-orthonormalise juste avant),
  // donc `|v|² = 1 + gEst² + gNord² ≥ 1`. La branche protège le CONTRAT de la
  // fonction pure, pas le GPU — et le jumeau GLSL la garde pour ne pas
  // diverger de son jumeau JS, ce qui coûterait plus cher qu'une comparaison.
  const r0 = repereSolSphere(-21.115, 55.536)
  for (const t of balayage(9)) {
    const gE = (t - 0.5) * 6
    const gN = (0.5 - t) * 3
    const v = [
      r0.haut[0] - gE * r0.est[0] - gN * r0.nord[0],
      r0.haut[1] - gE * r0.est[1] - gN * r0.nord[1],
      r0.haut[2] - gE * r0.est[2] - gN * r0.nord[2],
    ]
    assert.ok(Math.abs(NORME(v) ** 2 - (1 + gE * gE + gN * gN)) < 1e-9,
      'l identite |v|2 = 1 + g2 tombe : le repere n est plus orthonorme')
  }
  // ⑤ ⛔ **ET LES DEUX PENTES NE SONT PAS INTERCHANGEABLES.** Une mutation qui
  // les échange fait tourner le gradient de quatre-vingt-dix degrés et éclaire
  // les flancs perpendiculaires ; elle a survécu au premier tour de P9.
  const r = repereSolSphere(-21.115, 55.536)
  const droit = normaleParGradientSol(0.7, 0.2, r.est, r.nord, r.haut)
  const echange = normaleParGradientSol(0.2, 0.7, r.est, r.nord, r.haut)
  assert.ok(NORME([droit[0] - echange[0], droit[1] - echange[1], droit[2] - echange[2]]) > 0.05,
    'echanger les deux pentes ne change rien : le test ne mord pas')
})

test('⑧b ⚡ LA RÉDUCTION — la loi livrée EST celle de Mikkelsen, nourrie du repère', () => {
  // ⚠️ **C'EST L'ASSERTION QUI AUTORISE P10 À RETIRER LA LOI DE P9.** Mikkelsen
  // perturbe la normale qu'on lui donne à partir d'un paramétrage QUELCONQUE
  // (`sx`, `sy`) et des dérivées de `h` DANS CE PARAMÉTRAGE. Nourrie de
  // (est, nord) — orthonormé, donc `R1 = est`, `R2 = nord`, `det = 1` —, elle
  // rend exactement `haut − gEst·est − gNord·nord`, normalisé.
  let compares = 0
  for (const [lat, lon] of LIEUX) {
    const { est, nord, haut } = repereSolSphere(lat, lon)
    for (const t of balayage(13)) {
      const gE = (t - 0.5) * 3.1
      const gN = (0.5 - t) * 2.6
      const a = normaleParGradientSol(gE, gN, est, nord, haut)
      const m = normaleMikkelsen(est, nord, haut, gE, gN)
      for (let i = 0; i < 3; i++) assert.ok(Math.abs(a[i] - m[i]) < 1e-12, `${a} contre Mikkelsen ${m}`)
      compares++
    }
  }
  assert.ok(compares >= 60, `banc vide : ${compares} comparaisons`)
  // ⛔ **ET CE N'EST PAS UNE ÉGALITÉ TRIVIALE** : nourrie d'un paramétrage NON
  // orthonormé — celui des tangentes d'ÉCRAN, que P9 employait — la formule de
  // Mikkelsen rend un AUTRE vecteur. C'est bien le repère qui fait la réduction,
  // pas la formule.
  const { est, nord, haut } = repereSolSphere(-21.115, 55.536)
  const oblique = [est[0] * 2 + nord[0] * 0.6, est[1] * 2 + nord[1] * 0.6, est[2] * 2 + nord[2] * 0.6]
  const autre = normaleMikkelsen(oblique, nord, haut, 0.4, -0.2)
  const droit = normaleParGradientSol(0.4, -0.2, est, nord, haut)
  assert.ok(NORME([autre[0] - droit[0], autre[1] - droit[1], autre[2] - droit[2]]) > 0.02,
    'le contre-exemple ne mord pas : la reduction serait vraie pour n\'importe quoi')
})

test('⑧c l’oracle de ⑧b EST la formule de three, LUE DANS node_modules', () => {
  const bump = readFileSync(
    new URL('../node_modules/three/src/renderers/shaders/ShaderChunk/bumpmap_pars_fragment.glsl.js', import.meta.url),
    'utf8'
  ).replace(/\s+/g, ' ')
  // les quatre termes de Mikkelsen sont bien ceux que `normaleMikkelsen` écrit
  assert.match(bump, /vec3 R1 = cross\( vSigmaY, vN \);/)
  assert.match(bump, /vec3 R2 = cross\( vN, vSigmaX \);/)
  assert.match(bump, /float fDet = dot\( vSigmaX, R1 \)/)
  assert.match(bump, /vec3 vGrad = sign\( fDet \) \* \( dHdxy\.x \* R1 \+ dHdxy\.y \* R2 \);/)
  assert.match(bump, /return normalize\( abs\( fDet \) \* surf_norm - vGrad \);/)
  // ⛔ **ET C'EST BIEN SUR DES DÉRIVÉES D'ÉCRAN QUE `three` LA NOURRIT** : c'est
  // exactement ce que P10 a retiré, et ce que `three` continue de faire.
  assert.match(bump, /vec3 vSigmaX = normalize\( dFdx\( surf_pos\.xyz \) \);/)
  // ⛔ **ET PLUS AUCUNE LIGNE DE MIKKELSEN NE VIT DANS `src/`** : ni `cross`, ni
  // `sign(det)`, ni `abs(det)`. Si elle y revient, c'est que quelqu'un a refait
  // le chemin de P9 sans lire notation-03 §4.
  const loi = GLSL_NORMALE_FINE.replace(/\/\/[^\n]*/g, '')
  assert.ok(!/sign\s*\(/.test(loi) && !/cross\s*\(/.test(loi),
    'la loi livree porte encore la forme de Mikkelsen')
})

test('⑧d le repère de sol EST la dérivée de latLonToSphere — et le GLSL est son jumeau', () => {
  // ① ⚡ **CONTRE LE DÉPÔT, PAS CONTRE SON PROPRE COMMENTAIRE.** `haut` doit
  // être `latLonToSphere` normalisé, et les deux tangentes ses dérivées, prises
  // NUMÉRIQUEMENT sur la fonction du dépôt elle-même.
  const eps = 1e-6
  const pos = (la, lo) => { const v = latLonToSphere(la, lo, 1); return [v.x, v.y, v.z] }
  for (const [lat, lon] of LIEUX) {
    const { est, nord, haut } = repereSolSphere(lat, lon)
    const p = pos(lat, lon)
    for (let i = 0; i < 3; i++) assert.ok(Math.abs(haut[i] - p[i]) < 1e-12, `haut n'est pas latLonToSphere en ${lat},${lon}`)
    const dE = UNITE(pos(lat, lon + eps).map((v, i) => v - pos(lat, lon - eps)[i]))
    const dN = UNITE(pos(lat + eps, lon).map((v, i) => v - pos(lat - eps, lon)[i]))
    for (let i = 0; i < 3; i++) {
      assert.ok(Math.abs(est[i] - dE[i]) < 1e-6, `est n'est pas dP/dlon en ${lat},${lon}`)
      assert.ok(Math.abs(nord[i] - dN[i]) < 1e-6, `nord n'est pas dP/dlat en ${lat},${lon}`)
    }
    // ② ⚡ **LE TRIÈDRE EST DIRECT** — c'est ce qui autorise le nuanceur de
    // fragment à n'interpoler que DEUX varyings et à retrouver le nord par
    // `cross(haut, est)`. Un trièdre indirect retournerait le nord, donc
    // l'éclairage des versants nord-sud, sans qu'aucune erreur ne se lève.
    const c = CROIX(est, nord)
    for (let i = 0; i < 3; i++) assert.ok(Math.abs(c[i] - haut[i]) < 1e-12, `est x nord n'est pas haut en ${lat},${lon}`)
    const cn = CROIX(haut, est)
    for (let i = 0; i < 3; i++) assert.ok(Math.abs(cn[i] - nord[i]) < 1e-12, `haut x est n'est pas nord en ${lat},${lon}`)
    // et il est ORTHONORMÉ
    for (const v of [est, nord, haut]) assert.ok(Math.abs(NORME(v) - 1) < 1e-12)
    assert.ok(Math.abs(POINT(est, nord)) < 1e-12 && Math.abs(POINT(est, haut)) < 1e-12 && Math.abs(POINT(nord, haut)) < 1e-12)
  }
  // ③ ⚠️ **ET LES DEUX AUTRES LECTEURS DU REPÈRE PASSENT PAR LUI** : les trois
  // vecteurs étaient écrits DEUX fois dans le module avant P10.
  for (const [lat, lon] of LIEUX) {
    assert.deepEqual(hautLocal(lat, lon), repereSolSphere(lat, lon).haut)
  }
  const MOD_NU = readFileSync(new URL('../src/monde/eclairage-crop.js', import.meta.url), 'utf8')
    .replace(/\/\/[^\n]*/g, '')
    .replace(/\/\*[\s\S]*?\*\//g, '')
    .replace(/\s+/g, ' ')
  assert.match(MOD_NU, /export function hautLocal\(latDeg, lonDeg\) \{ return repereSolSphere\(latDeg, lonDeg\)\.haut \}/,
    'hautLocal reecrit la verticale au lieu de la lire')
  assert.match(MOD_NU, /const \{ est, nord, haut \} = repereSolSphere\(latDeg, lonDeg\)/,
    'directionSoleilLocale reecrit le repere au lieu de le lire')
  // ④ LA TRANSCRIPTION GLSL, terme à terme, SANS SES COMMENTAIRES.
  const rep = GLSL_REPERE_SOL.replace(/\/\/[^\n]*/g, '').replace(/\s+/g, ' ')
  assert.match(rep, /void repereSolSphere\(float latDeg, float lonDeg, out vec3 est, out vec3 nord, out vec3 haut\) \{/)
  assert.match(rep, /float la = radians\(latDeg\); float lo = radians\(lonDeg\);/)
  assert.match(rep, /est = vec3\(clo, 0\.0, -slo\);/)
  assert.match(rep, /nord = vec3\(-sla \* slo, cla, -sla \* clo\);/)
  assert.match(rep, /haut = vec3\(cla \* slo, sla, cla \* clo\);/)
  const nu = GLSL_NORMALE_FINE.replace(/\/\/[^\n]*/g, '').replace(/\s+/g, ' ')
  assert.match(nu, /vec3 normaleParGradientSol\(float gEst, float gNord, vec3 est, vec3 nord, vec3 haut\) \{/)
  assert.match(nu, /vec3 v = haut - gEst \* est - gNord \* nord;/)
  assert.match(nu, /float l = length\(v\);/)
  assert.match(nu, /return l > 0\.0 \? v \/ l : haut;/)
  // ⚠️ **CE QUI RESTE HORS DE PORTÉE, ET IL FAUT LE DIRE** : que le GPU exécute
  // ce texte. Ce fichier garantit que le JS que ⑧a et ⑧b vérifient et le GLSL
  // disent la MÊME chose ; l'écran, lui, est dans `.banc/P10/`.
})

// ⚡ **LE NUANCEUR CUIT, PAS LA SOURCE — Tâche P10.** `FRAG` est un template
// literal : lu dans le fichier, il porte encore le nom des deux conversions. Le
// matériau, lui, porte le TEXTE QUE LE GPU COMPILE, avec les nombres dedans — et
// c'est le seul endroit où l'on peut vérifier que la monnaie injectée est la
// bonne, et que l'injection a bien eu lieu.
const MAT_CUIT = new Globe({ radius: 100, globeExaggeration: 18 })._materialFor(null, 256, 2 ** -12)
const FRAG_CUIT = MAT_CUIT.fragmentShader.replace(/\/\/[^\n]*/g, '')
const VERT_CUIT = MAT_CUIT.vertexShader.replace(/\/\/[^\n]*/g, '')

test('⑧e ⛔ LE BRANCHEMENT DANS LE NUANCEUR — garde, base, monnaie, pas, et AUCUNE dérivée', () => {
  const nu = FRAG_CUIT.replace(/\s+/g, ' ')
  // ① la garde est un UNIFORME, déclaré, et le bloc est SOUS elle
  assert.match(FRAG_CUIT, /uniform float uNormaleFineOn;/)
  assert.match(FRAG_CUIT, /uniform float uUnitesParMetre;/)
  assert.match(FRAG_CUIT, /uniform float uUvParMonde;/)
  assert.match(nu, /if \(uNormaleFineOn > 0\.5\) \{ vec3 haut = normalize\(vHautW\);/)
  const bloc = nu.slice(nu.indexOf('if (uNormaleFineOn > 0.5)'), nu.indexOf('float nduCrop'))
  // ② ⛔ LA BASE EST LA SPHÈRE NUE, PAS `vNormalW` — c'est le point où un
  // implémenteur pressé compterait deux fois la pente du maillage.
  assert.ok(!/vNormalW/.test(bloc), 'la normale fine part de vNormalW : la pente grossiere est comptee deux fois')
  // ③ ⚡ **ET AUCUNE DÉRIVÉE D'ÉCRAN N'ENTRE DANS LE BLOC.** C'est TOUT ce que
  // node peut dire de l'invariance par translation — et c'est exactement la
  // régression que la Tâche P10 répare : `dFdx`, `dFdy` et `fwidth` y étaient.
  assert.ok(!/\bdFdx\b|\bdFdy\b|\bfwidth\b/.test(bloc),
    'une derivee d ecran est revenue dans la normale fine : la parite des quads avec')
  // ④ ⛔ LA MONNAIE — les deux conversions, et elles sont APPARIÉES. `metresParUv`
  // porte le cosinus de la latitude (Mercator rétrécit vers les pôles) et
  // `uniteParUv` la ramène en unités de scène ; `uUnitesParMetre` porte
  // l'exagération, `UNITES_PAR_METRE_SOL` ne la porte PAS. Les intervertir
  // rendrait des pentes fausses d'un facteur `exagération²`, en silence.
  assert.match(bloc, /float cosLat = max\(cos\(radians\(vLatLon\.x\)\), 1e-4\);/)
  assert.match(bloc, /float metresParUv = [\d.]+ \* uUvParMonde \* cosLat;/)
  assert.match(bloc, /float uniteParUv = metresParUv \* [\d.e-]+;/)
  assert.match(bloc, /float k = uUnitesParMetre \/ \(2\.0 \* pas \* uniteParUv\);/)
  assert.match(bloc, /normaleParGradientSol\(dhU \* k, dhV \* k, est, nord, haut\)/)
  // ⑤ le PAS : le texel est un PLANCHER, l'empreinte l'emporte quand elle est
  // plus grande, et sans `uMppFacteur` on retombe sur le texel — jamais sur
  // `fwidth`, qui ramènerait la parité par la fenêtre.
  assert.match(bloc, /float pasEmpreinte = uMppFacteur > 0\.0 \? vProfCam \* uMppFacteur \/ metresParUv : 0\.0;/)
  // ⛔ **ET L'EMPREINTE NE S'APPLIQUE PAS AU FOND MARIN — Tâche P12.** Sous
  // l'eau la hauteur ne vient pas du MNT mais du champ cuit, six fois plus
  // grossier : il n'y a rien à filtrer, et l'empreinte ne fait que perdre de la
  // pente (grain du fond marin 72,5 % du socle au pas livré, 85,1 % à un texel,
  // `.banc/P12/e1-pas-mer.js`). Le plancher d'un texel, lui, reste des DEUX
  // côtés — c'est le seul qui protège d'une différence prise plus fin que la
  // donnée. ⚠️ La loi elle-même est EXÉCUTÉE par `test/fond-crop.test.js` ⑩d.
  assert.match(bloc, /float pas = fondMarin \? \(1\.0 \/ uTilePx\) : max\(1\.0 \/ uTilePx, pasEmpreinte\);/)
  assert.equal((bloc.match(/1\.0 \/ uTilePx/g) || []).length, 2,
    'le plancher du texel doit rester sur les DEUX branches')
  // ⑥ ⛔ LE DÉCALAGE DE `qCrop` SUIT L'UV, ET LE SIGNE DU NORD EST RETOURNÉ.
  // `uv.y` croît vers le NORD (`1 - v` dans `_buildMesh`) quand le `y` de
  // Mercator croît vers le SUD. Le signe perdu, le fond marin serait lu de
  // l'autre côté du bloc — invisible sur un fond plat, faux sur un talus.
  // ⛔ **LE NORD DU FRAGMENT — UNE MUTATION SURVIVANTE.** `cross(est, haut)`
  // rendrait le SUD, et l'éclairage des versants nord-sud s'inverserait. ⑧d
  // prouve que le trièdre est direct ; ici on vérifie que le nuanceur s'en sert
  // dans le bon ordre.
  assert.match(bloc, /vec3 nord = cross\(haut, est\);/)
  // ⛔ **ET LE DEMI-CÔTÉ DU CROP DIVISE, IL NE MULTIPLIE PAS — deuxième
  // survivante.** `qCrop` est en demi-côtés : `q = (mercator − centre) /
  // uCropDemi`. Le test exécutable de la loi est juste en dessous (⑧e ter).
  assert.match(bloc, /float qParUv = uUvParMonde \/ max\(uCropDemi, 1e-9\);/)
  assert.match(bloc, /vec2 dqU = vec2\(qParUv \* pas, 0\.0\);/)
  assert.match(bloc, /vec2 dqV = vec2\(0\.0, -qParUv \* pas\);/)
  // ⑦ les quatre lectures sont CENTRÉES : `+pas` contre `−pas`, sur les deux axes
  assert.match(bloc, /float dhU = hauteurEchant\(vUv \+ vec2\(pas, 0\.0\), qCrop \+ dqU\) - hauteurEchant\(vUv - vec2\(pas, 0\.0\), qCrop - dqU\);/)
  assert.match(bloc, /float dhV = hauteurEchant\(vUv \+ vec2\(0\.0, pas\), qCrop \+ dqV\) - hauteurEchant\(vUv - vec2\(0\.0, pas\), qCrop - dqV\);/)
  // ⑧ ⚡ ET `hauteurEchant` EST LA MÊME LOI QUE `main()` — une seule écriture du
  // fond marin et du grain. Un second `texture2D(uFondChamp` dans le fragment
  // serait la « seconde écriture jumelle » que `terrain.js` documente.
  assert.equal((FRAG_CUIT.match(/texture2D\(uFondChamp/g) || []).length, 1,
    'le fond marin est lu par DEUX ecritures dans le nuanceur')
  assert.equal((FRAG_CUIT.match(/mnNoise\(gp\)/g) || []).length, 1,
    'le grain est ecrit DEUX fois dans le nuanceur')
  assert.match(nu, /float hauteurEchant\(vec2 uv, vec2 q\) \{ float hh = hauteurFond\(q, decodeMeters\(uv\)\); return uHabOn > 0\.5 \? hauteurGrain\(q, hh\) : hh; \}/)
  // et `main()` passe par les deux mêmes fonctions, dans l'ordre du dépôt
  assert.match(nu, /float h = hauteurFond\(qCrop, decodeMetersAA\(vUv\)\);/)
  assert.match(nu, /h = hauteurGrain\(qCrop, h\);/)
  assert.ok(nu.indexOf('bool sousEau =') > nu.indexOf('float h = hauteurFond(qCrop'),
    'sousEau est lu AVANT le fond marin')
  assert.ok(nu.indexOf('bool sousEau =') < nu.indexOf('h = hauteurGrain(qCrop, h);'),
    'le grain est applique AVANT sousEau : la rampe changerait de branche')
  // ⑨ les deux varyings existent des DEUX côtés, et `vVue` est bien parti
  assert.match(VERT_CUIT, /varying vec3 vEstW;/)
  assert.match(VERT_CUIT, /varying vec3 vHautW;/)
  assert.match(VERT_CUIT.replace(/\s+/g, ' '), /repereSolSphere\(latlon\.x, latlon\.y, estL, nordL, hautL\);/)
  assert.match(VERT_CUIT.replace(/\s+/g, ' '), /vEstW = mat3\(modelMatrix\) \* estL; vHautW = mat3\(modelMatrix\) \* hautL;/)
  // ⚠️ **ET LE REPÈRE EST BIEN ARRIVÉ DANS LE TEXTE COMPILÉ**, pas seulement
  // dans la source : une injection oubliée ne se verrait qu'à l'écran.
  assert.match(VERT_CUIT.replace(/\s+/g, ' '), /void repereSolSphere\(float latDeg, float lonDeg, out vec3 est, out vec3 nord, out vec3 haut\)/)
  assert.match(FRAG_CUIT, /varying vec3 vEstW;/)
  assert.match(FRAG_CUIT, /varying vec3 vHautW;/)
  assert.ok(!/\bvVue\b/.test(GLOBE_NU), 'le varying vVue de P9 est reste : il ne sert plus personne')
  // ⑩ et le texte des deux lois est INJECTÉ, pas recopié
  assert.ok(GLOBE_NU.includes('${GLSL_REPERE_SOL}'), 'le globe recopie le repere au lieu de l\'injecter')
  assert.ok(GLOBE_NU.includes('${GLSL_NORMALE_FINE}'), 'le globe recopie la loi au lieu de l\'injecter')
  const sansInjection = GLOBE_NU.replace('${GLSL_REPERE_SOL}', '').replace('${GLSL_NORMALE_FINE}', '')
  assert.ok(!/vec3 normaleParGradientSol\(float/.test(sansInjection),
    'une SECONDE ecriture de normaleParGradientSol vit dans globe.js')
  assert.ok(!/void repereSolSphere\(float/.test(sansInjection),
    'une SECONDE ecriture de repereSolSphere vit dans globe.js')
})

test('⑧e bis ⛔ `uUvParMonde` EST PROPRE À LA TUILE, ET IL VAUT `1 / 2^z`', () => {
  // ⚠️ **C'EST LA MONNAIE DE LA PENTE, ET CE CHANTIER A DÉJÀ PAYÉ QUATRE FOIS
  // CETTE FAMILLE DE FAUTES** (`uMerHoule` ×121,6, `skirtDrop` ×10). Une valeur
  // partagée ferait juger toutes les tuiles sur le niveau de la dernière
  // chargée — exactement le défaut que `uTilePx` documente à côté d'elle.
  const g = new Globe({ radius: 100, globeExaggeration: 18 })
  // ① le défaut est le niveau ZÉRO, donc un bloc PLAT : visible, pas silencieux.
  assert.equal(g._materialFor(null, 256).uniforms.uUvParMonde.value, 1)
  // ② et il n'est PAS dans `this.uniforms` : il ne s'étale pas
  assert.equal(g.uniforms.uUvParMonde, undefined, 'uUvParMonde est partage par toutes les tuiles')
  // ③ POSÉ, il suit le niveau — dans les DEUX sens, et sur toute la plage utile
  for (const z of [0, 2, 6, 12, 15, 22]) {
    assert.equal(g._materialFor(null, 256, 2 ** -z).uniforms.uUvParMonde.value, 2 ** -z)
  }
  // ④ ⚡ **ET C'EST BIEN `_buildMesh` QUI LE POSE**, avec le niveau de SA tuile.
  assert.match(GLOBE_NU.replace(/\s+/g, ' '),
    /this\._materialFor\(t\.texture, t\.size, 2 \*\* -t\.z\)/)
  // ⑤ ⚠️ **LA CONVERSION EN MÈTRES DE SOL EST JUSTE, ET ELLE EST VÉRIFIABLE À LA
  // MAIN** : une unité d'uv à z12, à la latitude de La Réunion, couvre la
  // largeur d'une tuile — 9 129 m relevés par `_makeDemSampler` (P9 publie
  // `extentMeters = 27 381` pour les TROIS tuiles du bloc).
  const tour = Number(FRAG_CUIT.match(/float metresParUv = ([\d.]+) \* uUvParMonde/)[1])
  const largeur = tour * 2 ** -12 * Math.cos((-21.115 * Math.PI) / 180)
  assert.ok(Math.abs(largeur * 3 - 27381) < 400, `le bloc ferait ${largeur * 3} m au lieu de 27 381`)
  // ⛔ **ET CE N'EST PAS `CIRCONFERENCE_M`** : la sphère du globe a le rayon
  // MOYEN, celui que `uUnitesParMetre` emploie. Prendre l'équateur WGS84 ferait
  // 0,11 % d'erreur — invisible, et faux.
  assert.ok(Math.abs(tour - 2 * Math.PI * EARTH_RADIUS_M) < 1, `le tour vaut ${tour}`)
  assert.ok(Math.abs(tour - 40075016.686) > 40000, 'le tour est celui de l\'equateur WGS84')
  // ⑥ ⚡ **L'INVARIANT QUI APPARIE LES DEUX CONVERSIONS, ET C'EST UNE MUTATION
  // SURVIVANTE QUI L'A DEMANDÉ.** Le tour est en MÈTRES, l'autre facteur est en
  // unités de scène PAR mètre : leur produit est donc la circonférence de la
  // sphère du globe EN UNITÉS DE SCÈNE, c'est-à-dire `2 π R_GLOBE`. Retourner
  // l'un ou l'autre — la faute d'`uMerHoule`, quatre fois payée — fait exploser
  // ce produit de neuf ordres de grandeur.
  const unite = Number(FRAG_CUIT.match(/float uniteParUv = metresParUv \* ([\d.e+-]+);/)[1])
  assert.ok(Math.abs(tour * unite - 2 * Math.PI * R_GLOBE) < 1e-6,
    `le tour en unites de scene vaut ${tour * unite} au lieu de ${2 * Math.PI * R_GLOBE}`)
})

test('⑧e ter ⛔ LE DÉCALAGE DE `qCrop` SUIT VRAIMENT L’UV — exécuté, pas cherché', () => {
  // ⚠️ **MUTATION SURVIVANTE** : `uUvParMonde * uCropDemi` au lieu de
  // `/ uCropDemi`. Le fond marin serait alors lu à des demi-côtés de distance du
  // point qu'on éclaire — invisible sur un fond plat, faux sur un talus.
  //
  // ⚠️ **ON N'ASSERTE PAS UNE CHAÎNE, ON REJOUE LA LOI** : `qCrop` est calculé
  // par le nuanceur depuis `vLatLon`, qui vient de `tileToLatLon`. On refait le
  // chemin sur la fonction DU DÉPÔT et on exige que la différence de `qCrop`
  // entre deux points séparés de `pas` en `uv` soit exactement ce que le bloc
  // pose — signe compris.
  const bloc = FRAG_CUIT.replace(/\s+/g, ' ')
  const bloc2 = bloc.slice(bloc.indexOf('if (uNormaleFineOn > 0.5)'), bloc.indexOf('float nduCrop'))
  assert.match(bloc2, /float qParUv = uUvParMonde \/ max\(uCropDemi, 1e-9\);/)
  // la transcription du nuanceur, ligne pour ligne (bloc « LA DÉCOUPE »)
  const mx = (lon) => (lon + 180) / 360
  const my = (lat) => 0.5 - Math.log(Math.tan(Math.PI / 4 + (lat * 0.017453292519943295) / 2)) / (2 * Math.PI)
  const DEMI = 0.000366210937 // uCropDemi relevé : trois tuiles z12 en demi-côtés de Mercator
  for (const z of [10, 12, 14]) {
    const uvParMonde = 2 ** -z
    const qParUv = uvParMonde / DEMI
    // une tuile quelconque, loin du méridien et de l'équateur
    const tx = Math.floor(2 ** z * mx(55.5))
    const ty = Math.floor(2 ** z * 0.6)
    for (const pas of [1 / 256, 1 / 64]) {
      for (const [u, v] of [[0.25, 0.4], [0.6, 0.75], [0.5, 0.5]]) {
        // uv.y = 1 − v (le « canvas row 0 = north » de `_buildMesh`)
        const q = (uu, vv) => {
          const p = tileToLatLon(tx + uu, ty + vv, z)
          return { x: (mx(p.lon) - 0) / DEMI, y: (my(p.lat) - 0) / DEMI }
        }
        const a0 = q(u, 1 - 0.5)
        // un pas de +`pas` en uv.x
        const aU = q(u + pas, 1 - 0.5)
        assert.ok(Math.abs(aU.x - a0.x - qParUv * pas) < 1e-9,
          `z=${z} : dq/duv.x rend ${aU.x - a0.x} au lieu de ${qParUv * pas}`)
        assert.ok(Math.abs(aU.y - a0.y) < 1e-12, 'un pas en uv.x bouge le q en y')
        // un pas de +`pas` en uv.y, donc de −`pas` en v de tuile : le SIGNE
        const aV = q(u, 1 - 0.5 - pas)
        assert.ok(Math.abs(aV.y - a0.y + qParUv * pas) < 1e-6,
          `z=${z} : dq/duv.y rend ${aV.y - a0.y} au lieu de ${-qParUv * pas}`)
        assert.ok(aV.y - a0.y < 0, 'le retournement « 1 - v » est perdu : le nord part au sud')
        assert.ok(v > 0, 'garde-fou de banc vide')
      }
    }
  }
})

test('⑧f ⛔ LE BRANCHEMENT DANS LA CHAÎNE — pose, retrait, veille, contexte, échelle', () => {
  const g = new Globe({ radius: 100, globeExaggeration: 18 })
  const u = g.uniforms
  // ① le défaut est le dépôt au bit près
  assert.equal(u.uNormaleFineOn.value, 0)
  assert.equal(HABILLAGE_MONDE.normaleFine, false)
  // ② POSÉE, elle s'allume ; POSÉE À FAUX, elle s'éteint — les deux sens.
  g.poserHabillage({ normaleFine: true })
  assert.equal(u.uNormaleFineOn.value, 1)
  g.poserHabillage({ normaleFine: false })
  assert.equal(u.uNormaleFineOn.value, 0, 'une pose a faux laisse la normale fine allumee')
  // ⚠️ **ET L'INTERRUPTEUR EST L'ABSENCE DE DONNÉE** — le patron de `uCropOn`,
  // `uHabOn`, `coastMask` et de l'ambiante de paroi (⑦c). Un appelant qui ne
  // connaît pas ce champ doit rendre l'image d'AVANT la Tâche P9, pas un globe
  // modelé au fragment sur toute la planète.
  g.poserHabillage({ normaleFine: true })
  g.poserHabillage({})
  assert.equal(u.uNormaleFineOn.value, 0, 'une pose SANS le champ allume la normale fine')
  // ③ et `retirerHabillage` la rend
  g.poserHabillage({ normaleFine: true })
  g.retirerHabillage()
  assert.equal(u.uNormaleFineOn.value, 0)
  // ④ la veille la SURVEILLE — sans quoi elle ne serait jamais reposée
  assert.ok(CHAMPS_HABILLAGE.includes('normaleFine'), 'la veille ne surveille pas normaleFine')
  assert.ok(habillageDifferent({ normaleFine: true }, { normaleFine: false }),
    'la veille ne voit pas normaleFine changer')
  // ⑤ ⚡ **ET `contexteCrop` LA PASSE** — c'est le maillon que ce chantier rate
  // treize fois sur treize. On lit le texte de `main.js`, sans ses commentaires.
  const ctx = MAIN_SRC.replace(/\/\/[^\n]*/g, '')
  const i = ctx.indexOf('habillage: {')
  assert.ok(i > 0, '`contexteCrop` n\'a plus d\'objet `habillage`')
  const bloc = ctx.slice(i, ctx.indexOf('paroiCouleur', i) + 40)
  assert.match(bloc, /normaleFine:\s*true/)
  // ⑥ ⛔ L'ÉCHELLE DE RELIEF EST JUSTE, ET ELLE SUIT L'EXAGÉRATION. Une échelle
  // fausse ne se voit pas : elle rend juste des pentes fausses. C'est la famille
  // de fautes que `uMerHoule` (121,6×) et `skirtDrop` (10×) ont coûtée.
  assert.ok(Math.abs(u.uUnitesParMetre.value - (100 / 6371000) * 18) < 1e-18,
    `uUnitesParMetre vaut ${u.uUnitesParMetre.value} a la naissance`)
  g._rechargeTuiles = () => {}
  g.setExaggeration(2.8)
  assert.ok(Math.abs(u.uUnitesParMetre.value - (100 / 6371000) * 2.8) < 1e-18,
    'l\'echelle de relief n\'a pas suivi setExaggeration')
  // ⑦ et elle est bien celle de `_buildMesh` — la MÊME formule, pas une voisine.
  assert.match(GLOBE_NU, /const dispScale = \(R_GLOBE \/ EARTH_RADIUS_M\) \* this\.exaggeration/)
})
