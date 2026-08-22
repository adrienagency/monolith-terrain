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
  // ⚠️ **La normale par fragment — Tache P9.**
  normaleParDeplacement,
  GLSL_NORMALE_FINE,
} from '../src/monde/eclairage-crop.js'
import { GLSL_MELANGE, APPARENCE_MONDE } from '../src/monde/melange-crop.js'
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

// ══════════ ⑧ LA NORMALE PAR FRAGMENT — Tâche P9 ════════════════════════════
//
// ⚠️ **CE QUE CE BLOC VÉRIFIE, ET DANS QUEL ORDRE** :
//   ⑧a la loi PURE, contre un oracle INDÉPENDANT — la surface déplacée est
//      construite point par point et sa normale obtenue par un vrai produit
//      vectoriel de différences finies. Le jumeau JS n'est donc pas comparé à
//      lui-même ;
//   ⑧b l'INVARIANCE D'ÉCHELLE D'ÉCRAN, qui est la propriété pour laquelle on
//      s'écarte de `three` — et le contre-exemple, la version de `three`, est
//      rejoué à côté pour montrer qu'elle, elle ne l'a pas ;
//   ⑧c la RÉFÉRENCE, LUE DANS `node_modules/three` : les quatre termes y sont,
//      et le `normalize( dFdx( surf_pos` aussi. Notre écart est donc réel,
//      nommé, et pas un oubli ;
//   ⑧d la TRANSCRIPTION GLSL, terme à terme, sur le texte SANS SES COMMENTAIRES ;
//   ⑧e le BRANCHEMENT dans le nuanceur — la faiblesse récurrente du chantier ;
//   ⑧f le BRANCHEMENT dans la chaîne : `poserHabillage`, `retirerHabillage`,
//      `CHAMPS_HABILLAGE`, `contexteCrop` et `setExaggeration`.

/** Le produit vectoriel et le produit scalaire, une fois pour tout ce bloc. */
const CROIX = (a, b) => [a[1] * b[2] - a[2] * b[1], a[2] * b[0] - a[0] * b[2], a[0] * b[1] - a[1] * b[0]]
const NORME = (v) => Math.hypot(v[0], v[1], v[2])
const UNITE = (v) => { const l = NORME(v); return [v[0] / l, v[1] / l, v[2] / l] }

/**
 * L'ORACLE INDÉPENDANT — il ne connaît pas `normaleParDeplacement`.
 *
 * La surface déplacée est `S(x, y) = P(x, y) + N · h(x, y)`. On la CONSTRUIT en
 * trois points (l'origine et un pas dans chaque direction d'écran) et on prend
 * le produit vectoriel des deux différences finies. C'est la définition, pas la
 * formule de Mikkelsen.
 */
function normaleOracle(sx, sy, n, dhx, dhy) {
  // ⚠️ **LE DÉPLACEMENT SE FAIT DEPUIS LE PLAN DE `n`**, parce que c'est la
  // surface qu'on décrit : la sphère nue, plus `h` le long de son rayon. Les
  // tangentes d'écran portent déjà la pente du maillage ; leur composante
  // radiale n'est pas un déplacement au sol.
  const proj = (v) => { const d = v[0] * n[0] + v[1] * n[1] + v[2] * n[2]; return [v[0] - n[0] * d, v[1] - n[1] * d, v[2] - n[2] * d] }
  const tx = proj(sx)
  const ty = proj(sy)
  const a = [tx[0] + n[0] * dhx, tx[1] + n[1] * dhx, tx[2] + n[2] * dhx]
  const b = [ty[0] + n[0] * dhy, ty[1] + n[1] * dhy, ty[2] + n[2] * dhy]
  const c = CROIX(a, b)
  // le produit vectoriel donne la normale au SIGNE de l'orientation près : on la
  // remet du côté de la normale de base, comme le fait `sign(fDet)`.
  const s = c[0] * n[0] + c[1] * n[1] + c[2] * n[2] >= 0 ? 1 : -1
  return UNITE([c[0] * s, c[1] * s, c[2] * s])
}

test('⑧a la normale par déplacement suit la DÉFINITION — oracle indépendant', () => {
  // ① gradient nul : la normale ne bouge pas d'un bit.
  assert.deepEqual(normaleParDeplacement([1, 0, 0], [0, 0, 1], [0, 1, 0], 0, 0), [0, 1, 0])
  // ② un cas à la main, vérifiable de tête : pente 1/2 vers l'est.
  const n2 = normaleParDeplacement([1, 0, 0], [0, 0, 1], [0, 1, 0], 0.5, 0)
  const attendu = UNITE([-0.5, 1, 0])
  for (let i = 0; i < 3; i++) assert.ok(Math.abs(n2[i] - attendu[i]) < 1e-12, `${n2} contre ${attendu}`)
  // ⚠️ **ET LE SENS EST LE BON** : le sol MONTE vers l'est, donc la normale se
  // penche vers l'OUEST. Une mutation de signe passerait l'égalité de norme.
  assert.ok(n2[0] < 0, 'la normale se penche du mauvais cote')
  // ③ ⚡ **LE BALAYAGE CONTRE L'ORACLE**, sur des repères et des pentes variés —
  // y compris un repère NON orthogonal et une base inclinée, où une formule
  // approchée « (−hx, 1, −hy) » tomberait.
  const bases = [
    { sx: [1, 0, 0], sy: [0, 0, 1], n: [0, 1, 0] },
    { sx: [0.7, 0.1, 0], sy: [0.2, -0.05, 0.9], n: UNITE([0.2, 0.95, -0.1]) },
    { sx: [3, -1, 2], sy: [-1, 0.5, 4], n: UNITE([1, 2, 3]) },
    { sx: [0.001, 0, 0], sy: [0, 0, 0.001], n: [0, 1, 0] },
  ]
  let compares = 0
  for (const b of bases) {
    for (const t of balayage(11)) {
      const dhx = (t - 0.5) * 0.9
      const dhy = (0.5 - t) * 0.4
      const a = normaleParDeplacement(b.sx, b.sy, b.n, dhx, dhy)
      const o = normaleOracle(b.sx, b.sy, b.n, dhx, dhy)
      for (let i = 0; i < 3; i++) assert.ok(Math.abs(a[i] - o[i]) < 1e-9, `${a} contre l'oracle ${o}`)
      compares++
    }
  }
  assert.ok(compares >= 48, `banc vide : ${compares} comparaisons`)
})

test('⑧b ⚡ L’INVARIANCE D’ÉCHELLE D’ÉCRAN — la raison de s’écarter de three', () => {
  // La géométrie ne dépend pas du zoom : rendre le MÊME sol deux fois plus près
  // double `dFdx(P)` ET `dFdx(h)`, et la normale doit être INCHANGÉE.
  const sx = [0.7, 0.1, 0]
  const sy = [0.2, -0.05, 0.9]
  const n = UNITE([0.2, 0.95, -0.1])
  const a = normaleParDeplacement(sx, sy, n, 0.13, -0.04)
  for (const k of [0.25, 2, 17]) {
    const b = normaleParDeplacement(sx.map((v) => v * k), sy.map((v) => v * k), n, 0.13 * k, -0.04 * k)
    for (let i = 0; i < 3; i++) assert.ok(Math.abs(a[i] - b[i]) < 1e-12, `k=${k} : ${b} contre ${a}`)
  }
  // ⛔ **ET LE CONTRE-EXEMPLE : LA VERSION DE `three`, REJOUÉE ICI, N'A PAS
  // CETTE PROPRIÉTÉ.** C'est elle qui normalise `sigma` ; son commentaire dit
  // pourquoi (« regardless of the texture's scale »), et c'est une convention
  // d'ARTISTE. Sous elle, la même montagne s'aplatit en s'éloignant.
  const troisJS = (sxx, syy, nn, dhx, dhy) => normaleParDeplacement(UNITE(sxx), UNITE(syy), nn, dhx, dhy)
  const t1 = troisJS(sx, sy, n, 0.13, -0.04)
  const t2 = troisJS(sx.map((v) => v * 2), sy.map((v) => v * 2), n, 0.13 * 2, -0.04 * 2)
  assert.ok(Math.abs(t1[0] - t2[0]) > 0.02, 'la version de three serait invariante : le contre-exemple ne mord pas')
})

test('⑧c la référence est LUE DANS node_modules/three, et l’écart est nommé', () => {
  const bump = readFileSync(
    new URL('../node_modules/three/src/renderers/shaders/ShaderChunk/bumpmap_pars_fragment.glsl.js', import.meta.url),
    'utf8'
  ).replace(/\s+/g, ' ')
  // les quatre termes de Mikkelsen sont bien ceux-là, chez three
  assert.match(bump, /vec3 R1 = cross\( vSigmaY, vN \);/)
  assert.match(bump, /vec3 R2 = cross\( vN, vSigmaX \);/)
  assert.match(bump, /float fDet = dot\( vSigmaX, R1 \)/)
  assert.match(bump, /vec3 vGrad = sign\( fDet \) \* \( dHdxy\.x \* R1 \+ dHdxy\.y \* R2 \);/)
  assert.match(bump, /return normalize\( abs\( fDet \) \* surf_norm - vGrad \);/)
  // ⚡ **ET L'ÉCART EST RÉEL** : c'est bien three qui normalise, et nous qui ne
  // le faisons pas. Le jour où three cesse de normaliser, ce test rougit et le
  // commentaire du module devient faux : il faudra le corriger.
  assert.match(bump, /vec3 vSigmaX = normalize\( dFdx\( surf_pos\.xyz \) \);/)
  const nu = GLSL_NORMALE_FINE.replace(/\/\/[^\n]*/g, '')
  assert.ok(!/normalize\s*\(\s*sx\s*\)/.test(nu) && !/normalize\s*\(\s*sy\s*\)/.test(nu),
    'le crop normalise sigma : il reprend la convention d\'artiste de three, et la pente suivrait le zoom')
})

test('⑧d le GLSL est la TRANSCRIPTION du jumeau JS — terme à terme, sans commentaires', () => {
  // ⚠️ **SANS SES COMMENTAIRES** : la Tâche K ter a trouvé une assertion verte
  // parce qu'elle lisait une formule DANS UN COMMENTAIRE.
  const nu = GLSL_NORMALE_FINE.replace(/\/\/[^\n]*/g, '').replace(/\s+/g, ' ')
  assert.match(nu, /vec3 normaleFineCrop\(vec3 sx, vec3 sy, vec3 n, float dhx, float dhy\) \{/)
  assert.match(nu, /vec3 tx = sx - n \* dot\(sx, n\);/)
  assert.match(nu, /vec3 ty = sy - n \* dot\(sy, n\);/)
  assert.match(nu, /vec3 r1 = cross\(ty, n\);/)
  assert.match(nu, /vec3 r2 = cross\(n, tx\);/)
  assert.match(nu, /float det = dot\(tx, r1\);/)
  assert.match(nu, /vec3 grad = sign\(det\) \* \(dhx \* r1 \+ dhy \* r2\);/)
  assert.match(nu, /vec3 v = abs\(det\) \* n - grad;/)
  assert.match(nu, /return l > 0\.0 \? v \/ l : n;/)
  // et la transposée, qui n'existe pas en GLSL ES 1.0
  assert.match(nu, /vec3 nMondeDepuisVue\(mat3 V, vec3 u\) \{ return normalize\(vec3\(dot\(V\[0\], u\), dot\(V\[1\], u\), dot\(V\[2\], u\)\)\); \}/)
  // ⚠️ **CE QUI RESTE HORS DE PORTÉE, ET IL FAUT LE DIRE** : que le GPU exécute
  // ce texte. Ce que ce fichier peut faire, c'est garantir que le JS que ⑧a
  // vérifie contre un oracle et le GLSL disent la MÊME chose ; l'écran, lui, est
  // dans `.banc/P9/` et dans le compte rendu de la tâche.
})

test('⑧e ⛔ LE BRANCHEMENT DANS LE NUANCEUR — garde, base, échelle, varying', () => {
  const nu = FRAG_NU.replace(/\s+/g, ' ')
  // ① la garde est un UNIFORME, déclaré, et le bloc est SOUS elle
  assert.match(FRAG_NU, /uniform float uNormaleFineOn;/)
  assert.match(FRAG_NU, /uniform float uUnitesParMetre;/)
  assert.match(nu, /if \(uNormaleFineOn > 0\.5\) \{ vec3 nSphere/)
  // ② ⛔ LA BASE EST LA SPHÈRE NUE, PAS `vNormalW` — c'est le point où un
  // implémenteur pressé compterait deux fois la pente du maillage.
  assert.match(nu, /vec3 nSphere = normalize\(vVue - vec3\(viewMatrix\[3\]\)\);/)
  const bloc = nu.slice(nu.indexOf('if (uNormaleFineOn > 0.5)'), nu.indexOf('float nduCrop'))
  assert.ok(!/vNormalW/.test(bloc), 'la normale fine part de vNormalW : la pente grossiere est comptee deux fois')
  // ③ l'échelle est APPLIQUÉE aux DEUX dérivées, pas à une seule
  assert.match(bloc, /dFdx\(h\) \* uUnitesParMetre, dFdy\(h\) \* uUnitesParMetre/)
  // ④ et c'est bien `h`, la hauteur du fragment APRÈS le fond marin et le grain
  assert.ok(nu.indexOf('if (uNormaleFineOn > 0.5)') > nu.indexOf('h += uGrainForceM'),
    'la normale fine est calculee AVANT le grain : elle deriverait une autre surface')
  // ⑤ le varying existe des DEUX côtés
  const VERT_SRC = GLOBE_SRC.slice(GLOBE_SRC.indexOf('const VERT ='), GLOBE_SRC.indexOf('const FRAG ='))
  assert.match(VERT_SRC.replace(/\/\/[^\n]*/g, ''), /varying vec3 vVue;/)
  assert.match(VERT_SRC.replace(/\/\/[^\n]*/g, ''), /vVue = mv\.xyz;/)
  assert.match(FRAG_NU, /varying vec3 vVue;/)
  // ⑥ et le texte de la loi est INJECTÉ, pas recopié
  assert.ok(GLOBE_NU.includes('${GLSL_NORMALE_FINE}'), 'le globe recopie la loi au lieu de l\'injecter')
  assert.ok(!/vec3 normaleFineCrop\(vec3/.test(GLOBE_NU.replace('${GLSL_NORMALE_FINE}', '')),
    'une SECONDE ecriture de normaleFineCrop vit dans globe.js')
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
