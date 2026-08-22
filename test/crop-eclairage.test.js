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
  GLSL_ECLAIRAGE,
  GLSL_OMBRE_PEINTURE,
} from '../src/monde/eclairage-crop.js'
import { GLSL_MELANGE, APPARENCE_MONDE } from '../src/monde/melange-crop.js'
import { LUMA_709 } from '../src/monde/naturel-crop.js'
import { CHAMPS_HABILLAGE, habillageDifferent } from '../src/monde/branchement-crop.js'
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
  assert.equal(/envMapIntensity/.test(ctx), false)
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
  const VIVANT = /^\s*(terrain\.|sun\.|hemi\.|scene\.|plinth\.|centre\.|coefAmbiante\(|params\.sun|`#\$\{)/
  let n = 0
  for (const champ of CHAMPS_P3) {
    const m = ctx.match(new RegExp(`\\n\\s*${champ}:([^\\n]*)`))
    assert.ok(m, `${champ} n'est pas rempli par contexteCrop`)
    assert.match(m[1], VIVANT, `${champ} est figé : « ${m[1].trim()} »`)
    n++
  }
  assert.equal(n, CHAMPS_P3.length)
  assert.equal(n, 27) // le dénominateur est COMPTÉ, pas annoncé par le titre
})

test('④d poserHabillage POSE les uniformes, et retirerHabillage les REND', () => {
  const g = new Globe({ radius: 100 })
  const u = g.uniforms
  const depart = {
    eclairage: u.uEclairageOn.value,
    soleil: u.uSoleilIrr.value.toArray(),
    ciel: u.uCielIrr.value.toArray(),
    sol: u.uSolIrr.value.toArray(),
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
  // la verticale locale et le soleil sont des vecteurs UNITAIRES
  assert.ok(Math.abs(u.uHemiHaut.value.length() - 1) < 1e-9)
  assert.ok(Math.abs(u.uSoleilDir.value.length() - 1) < 1e-9)

  g.retirerHabillage()
  assert.equal(u.uEclairageOn.value, depart.eclairage)
  assert.deepEqual(u.uSoleilIrr.value.toArray(), depart.soleil)
  assert.deepEqual(u.uCielIrr.value.toArray(), depart.ciel)
  assert.deepEqual(u.uSolIrr.value.toArray(), depart.sol)
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
  assert.match(FRAG_NU, /colPlanete = mix\(uShadowColor, colPlanete, 0\.10 \+ 0\.90 \* day\);/)
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
  for (const nom of ['uSoleilDir', 'uHemiHaut', 'uSoleilIrr', 'uCielIrr', 'uSolIrr', 'uEclairageOn']) {
    assert.equal(m.uniforms[nom], g.uniforms[nom], `${nom} doit être PARTAGÉ avec les tuiles`)
  }
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
  assert.match(bloc, /colPlanete = mix\(uShadowColor, colPlanete, 0\.10 \+ 0\.90 \* day\);/)
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
