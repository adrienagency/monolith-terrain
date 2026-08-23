// LA COLORISATION NATURELLE, PARTAGÉE — Tâche P2 du plan « LE STUDIO SUR LE
// GLOBE » (`docs/superpowers/plans/2026-08-22-globe-studio.md`).
//
// ══════════ CE QUE CE FICHIER VÉRIFIE, ET CE QU'IL NE PEUT PAS ══════════════
//
// Même partage que `crop-sphere`, `crop-parois`, `crop-habillage` et
// `crop-rampe` :
//   ① LA LOI vit dans un module PUR (`src/monde/naturel-crop.js`) et se vérifie
//      sous node, point par point ;
//   ② LE TEXTE GLSL est **TRADUIT ET EXÉCUTÉ**, jamais cherché par son nom. Le
//      piège que ce chantier a payé huit fois, c'est l'assertion verte parce
//      qu'un mot figure quelque part — la Tâche K ter en a trouvé une qui lisait
//      la formule DANS UN COMMENTAIRE.
//   ③ **L'UNICITÉ DE L'ÉCRITURE** est elle-même une assertion : aucune des
//      formules ne doit reparaître dans `terrain.js` ni dans `globe.js`.
//
// ⚠️ **CE QUI RESTE HORS DE PORTÉE** : que le GPU exécute ce texte, et que
// l'image obtenue ressemble à celle du socle. Seul l'écran le dit — c'est
// l'Étape 7 de la tâche et son compte rendu, pas ce fichier.
//
// ══════════ POURQUOI LE TRANSPILEUR EST CANAL PAR CANAL ════════════════════
//
// Les quatre fonctions vectorielles du module (`natSoftLight`, `natPeigne`,
// `natBrume`, et le `mix` de `natRampT`… qui est scalaire) sont **rigoureusement
// composante par composante**. On peut donc exécuter leur texte GLSL avec des
// SCALAIRES, un canal à la fois, et obtenir le résultat exact — sans écrire un
// interpréteur de vecteurs, qui serait une TROISIÈME écriture de la loi.
//
// ⚠️ **`natLuminance` EST LA SEULE EXCEPTION**, parce que `dot` mélange les
// canaux. C'est aussi pourquoi `natBrume` prend `lum` en ARGUMENT au lieu de le
// calculer : sans cela, la fonction la plus riche du module aurait été la seule
// non exécutable par ce protocole. `natLuminance` est vérifiée autrement — on
// EXTRAIT ses trois coefficients du texte et on les confronte à `LUMA_709`.

import test from 'node:test'
import assert from 'node:assert/strict'
import { readFileSync } from 'node:fs'

import {
  GAIN_HUMIDITE,
  GAIN_PEIGNE,
  PART_OMBRAGE,
  BANDE_VEGETATION,
  MARGE_PIVOT,
  PLAFOND_PIVOT,
  LUMA_709,
  NATUREL_MONDE,
  GLSL_NATUREL,
  smoothstep,
  plancherPivot,
  rampeT,
  humiditeY,
  ecartPeigne,
  softLight,
  peigne,
  luminance,
  voile,
  brume,
} from '../src/monde/naturel-crop.js'
import { CHAMPS_HABILLAGE, habillageDifferent } from '../src/monde/branchement-crop.js'
import { Globe } from '../src/globe.js'

const GLOBE_SRC = readFileSync(new URL('../src/globe.js', import.meta.url), 'utf8')
const TERRAIN_SRC = readFileSync(new URL('../src/terrain.js', import.meta.url), 'utf8')
const MAIN_SRC = readFileSync(new URL('../src/main.js', import.meta.url), 'utf8')
const FRAG_GLOBE = GLOBE_SRC.slice(GLOBE_SRC.indexOf('const FRAG ='), GLOBE_SRC.indexOf('\nconst ', GLOBE_SRC.indexOf('const FRAG =') + 10))
/** Le même fragment, SANS SES COMMENTAIRES — voir ⑤b pour ce qu'ils coûtent. */
const FRAG_NU = FRAG_GLOBE.replace(/\/\/[^\n]*/g, '')

// ══════════ L'OUTILLAGE — TRADUIRE LE GLSL, PUIS L'EXÉCUTER ════════════════

const CLAMP = (x, a, b) => Math.min(Math.max(x, a), b)
const MIX = (a, b, t) => a + (b - a) * t
const STEP = (bord, x) => (x < bord ? 0 : 1)
const SMOOTHSTEP = (b0, b1, x) => {
  const t = CLAMP((x - b0) / (b1 - b0), 0, 1)
  return t * t * (3 - 2 * t)
}

/**
 * Le TEXTE de `GLSL_NATUREL`, rendu exécutable en JS — canal par canal.
 *
 * ⚠️ **AUCUNE FORMULE N'EST RÉÉCRITE ICI** : seuls les MOTS du langage sont
 * remplacés (`float`/`vec3` → `let`, `clamp` → `CLAMP`, …). Si une constante du
 * nuanceur change, la traduction la porte, et la comparaison au jumeau JS tombe.
 */
function traduire(glsl) {
  return (
    glsl
      // les commentaires d'abord : ils portent des mots du langage
      .replace(/\/\/[^\n]*/g, '')
      // `natLuminance` mélange les canaux (dot) : hors protocole, vérifiée à part
      .replace(/float natLuminance\(vec3 c\) \{[^}]*\}/, '')
      // signatures : `float f(float a, vec3 b)` → `function f(a, b)`
      .replace(/\b(?:float|vec3|vec4)\s+(nat\w+)\s*\(([^)]*)\)\s*\{/g, (_, nom, args) => {
        const noms = args
          .split(',')
          .map((a) => a.trim().split(/\s+/).pop())
          .filter(Boolean)
        return `function ${nom}(${noms.join(', ')}) {`
      })
      // constructeurs à UN argument : la diffusion d'un scalaire sur trois canaux
      .replace(/\bvec3\s*\(/g, '(')
      // déclarations locales
      .replace(/\b(?:float|vec3|vec4)\s+(\w+)\s*=/g, 'let $1 =')
      // fonctions intrinsèques
      .replace(/\bsmoothstep\s*\(/g, 'SMOOTHSTEP(')
      .replace(/\bclamp\s*\(/g, 'CLAMP(')
      .replace(/\bstep\s*\(/g, 'STEP(')
      .replace(/\bmix\s*\(/g, 'MIX(')
      .replace(/\bmax\s*\(/g, 'Math.max(')
      .replace(/\bmin\s*\(/g, 'Math.min(')
      .replace(/\bsqrt\s*\(/g, 'Math.sqrt(')
  )
}

const JS_NATUREL = traduire(GLSL_NATUREL)
// eslint-disable-next-line no-new-func
const NUANCEUR = new Function(
  'CLAMP',
  'MIX',
  'STEP',
  'SMOOTHSTEP',
  `${JS_NATUREL}
   return { natPlancherPivot, natRampT, natHumiditeY, natEcartPeigne, natSoftLight, natPeigne, natVoile, natBrume }`
)(CLAMP, MIX, STEP, SMOOTHSTEP)

/** Un balayage reproductible — pas de hasard, donc pas de test qui clignote. */
function* balayage(n = 41) {
  for (let i = 0; i <= n; i++) yield i / n
}

// ══════════ ① LA LOI PURE — LES CONSTANTES ONT UNE SOURCE ══════════════════

test('①a les constantes sont celles du dépôt, pas des nombres choisis', () => {
  // ⚠️ CHAQUE CHIFFRE A SA JUSTIFICATION DANS `terrain.js` : 4,86 = 1,62 (la
  // compensation du soft-clip d'`encodeTextureShade`) × 3 (demande d'Adrien).
  assert.equal(GAIN_HUMIDITE, 4.86)
  assert.equal(GAIN_PEIGNE, 3)
  assert.equal(PART_OMBRAGE, 0.35)
  assert.equal(BANDE_VEGETATION, 0.18)
  assert.equal(MARGE_PIVOT, 0.02)
  assert.equal(PLAFOND_PIVOT, 0.95)
  assert.deepEqual([...LUMA_709], [0.2126, 0.7152, 0.0722])
  // et la luminance Rec. 709 somme à 1 — sinon elle éclaircirait ou assombrirait
  assert.ok(Math.abs(LUMA_709.reduce((a, b) => a + b, 0) - 1) < 1e-12)
})

test('①b AUX DÉFAUTS, natRampT rend hNorm — et l’écart est MESURÉ, pas déclaré nul', () => {
  // ⚠️ **PREMIÈRE RÉDACTION : « AU BIT PRÈS ». ELLE ÉTAIT FAUSSE, ET LE TEST L'A
  // DIT.** `0,5 + (hNorm − 0,5) · 1` n'est PAS `hNorm` en virgule flottante :
  // sur 100 001 valeurs, l'écart maximal vaut **2,78 × 10⁻¹⁷** en float64
  // (à `hNorm = 0,00136`) et **1,49 × 10⁻⁸** en float32, la précision du GPU
  // (à `hNorm ≈ 0,00203`). Le relevé est reproductible :
  // `node -e "…rampeT(h, 0.5, 1) − h…"`.
  //
  // ⚠️ **CE QUE ÇA CHANGE, ET RIEN DE PLUS** : le LUT fait 512 texels de large,
  // donc **un texel vaut 1,95 × 10⁻³** — l'écart du GPU est **131 000 fois plus
  // petit qu'un texel**. La loi est donc neutre À L'ÉCRAN, et elle ne l'est pas
  // au bit. **Le filet bit-à-bit de la production, lui, reste `uRampCropOn = 0`**,
  // qui laisse `texture2D(uRamp, vec2(t, 0.5))` intouché — c'est ④e qui le tient.
  const ECART_MAX = 1e-16
  let pire = 0
  for (const h of balayage(100000)) {
    const v = rampeT(h, NATUREL_MONDE.heightPivot, NATUREL_MONDE.heightContrast)
    pire = Math.max(pire, Math.abs(v - h))
  }
  assert.ok(pire < ECART_MAX, `écart maximal ${pire}, au-dessus de ${ECART_MAX}`)
  assert.ok(pire > 0, 'écart RIGOUREUSEMENT nul : le balayage ne balaie plus rien')
  assert.ok(pire * 512 < 1e-13, 'l’écart n’est plus négligeable devant un texel de LUT')
})

test('①c le pivot ne descend JAMAIS sous le niveau de la mer', () => {
  // le défaut vu et corrigé côté socle : « with a low pivot the whole coastal
  // band rides the top of the ramp and land loses its low tints »
  assert.equal(plancherPivot(0), MARGE_PIVOT)
  assert.equal(plancherPivot(-5), MARGE_PIVOT) // un crop entièrement au-dessus de la mer
  assert.equal(plancherPivot(0.5), 0.52)
  assert.equal(plancherPivot(2), PLAFOND_PIVOT + MARGE_PIVOT) // écrêté, jamais 2,02
  // un pivot d'utilisateur plus HAUT que le plancher gagne : c'est un réglage
  assert.equal(Math.max(0.6, plancherPivot(0)), 0.6)
})

test('①d le second axe du LUT est NEUTRE sans réglage, et il MORD avec', () => {
  const base = { canalB: 0.5, canalA: 0.5, hNorm: 0.3, wetK: 0.96, expoK: 0.35, hemi: 1, treeLine: 0.62 }
  // analyse neutre → ligne médiane du LUT, donc la rampe historique
  assert.equal(humiditeY(base), 0.5)
  // réglages nuls → ligne médiane quelle que soit l'analyse
  for (const b of balayage()) {
    assert.equal(humiditeY({ ...base, canalB: b, wetK: 0, expoK: 0 }), 0.5)
  }
  // ⚠️ LE 95e CENTILE DOIT ATTEINDRE LE BORD DU LUT AU RÉGLAGE 1 — c'est toute
  // la justification du gain, et elle est VÉRIFIÉE, pas citée : `encodeTexture
  // Shade` place ce centile à 0,808, soit 0,616 une fois ramené en ±1.
  const y = humiditeY({ ...base, canalB: 0.808, wetK: 1, expoK: 0 })
  assert.ok(y > 0.99, `le 95e centile ne monte qu'à ${y} — le gain ne mord plus`)
  // au-dessus de la limite des arbres, humidité et exposition s'éteignent
  assert.equal(humiditeY({ ...base, canalB: 1, hNorm: 0.62 + BANDE_VEGETATION }), 0.5)
  // l'hémisphère sud renverse l'exposition, et lui seul
  const nord = humiditeY({ ...base, canalA: 0.9, wetK: 0, expoK: 0.35, hemi: 1 })
  const sud = humiditeY({ ...base, canalA: 0.9, wetK: 0, expoK: 0.35, hemi: -1 })
  assert.ok(Math.abs(nord + sud - 1) < 1e-12, `${nord} et ${sud} ne sont pas symétriques`)
})

test('①e le SOFT LIGHT ne bouge pas une couleur quand le signal est neutre', () => {
  // ⚠️ **CE POINT FIXE EST LA GARANTIE DE LA PALETTE.** À s = 0,5 le soft light
  // du W3C rend b : une analyse plate ne peut donc pas désaturer la carte, quel
  // que soit `texShade`. Une mutation qui remplacerait le soft light par une
  // multiplication (le défaut nommé dans `terrain.js`) tombe ici.
  for (const b of balayage(200)) assert.ok(Math.abs(softLight(b, 0.5) - b) < 1e-15, `b=${b}`)
  // et il éclaircit au-dessus de 0,5, assombrit en dessous — sans sortir de [0,1]
  for (const b of balayage(50)) {
    for (const s of balayage(50)) {
      const v = softLight(b, s)
      assert.ok(v >= -1e-12 && v <= 1 + 1e-12, `b=${b} s=${s} → ${v}`)
      if (b > 0 && b < 1) {
        if (s > 0.5) assert.ok(v >= b - 1e-12, `b=${b} s=${s} n'éclaircit pas`)
        if (s < 0.5) assert.ok(v <= b + 1e-12, `b=${b} s=${s} n'assombrit pas`)
      }
    }
  }
})

test('①f le peigné À DOSE NULLE laisse la couleur intacte, et l’ombrage suit le peigné', () => {
  for (const c of balayage(50)) assert.ok(Object.is(peigne(c, 0.9, 0.1, 0), c), `c=${c}`)
  // ⚠️ **L'OMBRAGE LIT LE RÉSULTAT DU PEIGNÉ, PAS LA COULEUR D'ORIGINE.** Deux
  // modelés indépendants moyennés seraient PLUS PLATS, et rien ne le signalerait.
  const col = 0.42
  const k = 0.6
  const apresPeigne = MIX(col, softLight(col, ecartPeigne(0.85)), k)
  const attendu = MIX(apresPeigne, softLight(apresPeigne, ecartPeigne(0.2)), k * PART_OMBRAGE)
  assert.ok(Math.abs(peigne(col, 0.85, 0.2, k) - attendu) < 1e-15)
  const naif = MIX(apresPeigne, softLight(col, ecartPeigne(0.2)), k * PART_OMBRAGE)
  assert.notEqual(attendu, naif) // la version « repart de l'origine » diverge bien
})

test('①g le voile a DEUX composantes, et l’altitude seule suffit à le lever', () => {
  const base = { hNorm: 0, fd: 0, hazeAmt: 0.45, hazeAlt: 0.5, hazeDist: 0.5 }
  // à distance nulle, une plaine se voile quand même — c'est la Hoehenmodulation
  assert.ok(voile(base) > 0, 'le voile d’altitude ne mord pas')
  // un sommet à distance nulle n'est pas voilé du tout
  assert.equal(voile({ ...base, hNorm: 1 }), 0)
  // le plafond à 0,9 tient, même à force démente
  assert.equal(voile({ ...base, hazeAmt: 10, fd: 1 }), 0.9)
  // et à force nulle, rien
  assert.equal(voile({ ...base, hazeAmt: 0, fd: 1 }), 0)
})

test('①h la brume DÉSATURE avant de virer, et le rehaussement est indissociable', () => {
  // à voile nul, la couleur ressort intacte SAUF le rehaussement, qui est alors
  // maximal — c'est exactement le sommet qui reprend le mordant de la plaine
  const col = 0.3
  const sansVoile = brume({ col, lum: 0.5, veil: 0, couleur: 0.7, hazeAmt: 0.45 })
  assert.ok(sansVoile < col, 'le rehaussement ne mord pas sur les valeurs basses')
  // ⚠️ **À FORCE NULLE LA BRUME EST L'IDENTITÉ — MAIS PAS AU BIT PRÈS, ET IL
  // FAUT LE DIRE.** `(c − 0,5) · 1 + 0,5` ne rend pas `c` en virgule flottante
  // (0,02 ressort à 0,020000000000000018). Ce n'est pas un défaut : le nuanceur
  // ne franchit ce bloc que sous `uHazeAmt > 0.001`, donc l'identité n'est jamais
  // exercée. On l'affirme à l'ULP près plutôt que de la déclarer exacte — un
  // `Object.is` ici aurait été une promesse fausse.
  for (const c of balayage(50)) {
    const v = brume({ col: c, lum: 0.5, veil: 0, couleur: 0.7, hazeAmt: 0 })
    assert.ok(Math.abs(v - c) < 1e-15, `c=${c} → ${v}`)
  }
  assert.match(FRAG_GLOBE, /uHazeAmt > 0\.001/) // la garde qui rend l'identité inatteignable
  // et la luminance est celle de Rec. 709
  assert.ok(Math.abs(luminance([1, 1, 1]) - 1) < 1e-12)
  assert.ok(Math.abs(luminance([0, 1, 0]) - LUMA_709[1]) < 1e-15)
})

// ══════════ ② LE TEXTE GLSL, TRADUIT PUIS EXÉCUTÉ ══════════════════════════

test('②a le traducteur a bien produit les huit fonctions — sinon ② ne prouve rien', () => {
  // ⚠️ **UN TRADUCTEUR QUI RATE SA CIBLE REND UN TEST VERT ET VIDE.** C'est la
  // neuvième façon de mentir du §0 : un banc qui ne rend rien ressemble à un
  // banc qui rend juste. On exige donc les fonctions AVANT de les comparer.
  for (const nom of ['natPlancherPivot', 'natRampT', 'natHumiditeY', 'natEcartPeigne', 'natSoftLight', 'natPeigne', 'natVoile', 'natBrume']) {
    assert.equal(typeof NUANCEUR[nom], 'function', `${nom} n'a pas été traduite`)
  }
  // et le texte traduit ne doit plus porter un seul type GLSL
  assert.ok(!/\b(?:float|vec3|vec4)\b/.test(JS_NATUREL), JS_NATUREL.slice(0, 400))
})

test('②b natPlancherPivot / natRampT / natEcartPeigne : le TEXTE égale la loi', () => {
  for (const x of balayage(200)) {
    assert.equal(NUANCEUR.natPlancherPivot(x), plancherPivot(x), `x=${x}`)
    assert.equal(NUANCEUR.natEcartPeigne(x), ecartPeigne(x), `x=${x}`)
  }
  assert.equal(NUANCEUR.natPlancherPivot(-3), plancherPivot(-3))
  assert.equal(NUANCEUR.natPlancherPivot(4), plancherPivot(4))
  for (const h of balayage(30)) {
    for (const p of [0, 0.47, 0.5, 0.6, 1]) {
      for (const c of [0.4, 1, 1.5, 5.1]) {
        assert.equal(NUANCEUR.natRampT(h, p, c), rampeT(h, p, c), `h=${h} p=${p} c=${c}`)
      }
    }
  }
})

test('②c natHumiditeY : le TEXTE égale la loi — sur 3 528 combinaisons', () => {
  let n = 0
  for (const b of balayage(6)) {
    for (const a of balayage(6)) {
      for (const h of balayage(5)) {
        for (const wk of [0, 0.55, 0.96]) {
          for (const ek of [0, 0.35]) {
            for (const hemi of [1, -1]) {
              n++
              assert.equal(
                NUANCEUR.natHumiditeY(b, a, h, wk, ek, hemi, 0.62),
                humiditeY({ canalB: b, canalA: a, hNorm: h, wetK: wk, expoK: ek, hemi, treeLine: 0.62 }),
                `b=${b} a=${a} h=${h}`
              )
            }
          }
        }
      }
    }
  }
  // ⚠️ LE DÉNOMINATEUR EST ÉCRIT PAR LA BOUCLE, PAS PAR LE TITRE — un titre qui
  // annonce un compte que la boucle ne fait pas est un chiffre faux.
  assert.equal(n, 3528, `le balayage a fait ${n} combinaisons, pas 3 528`)
})

test('②d natSoftLight et natPeigne : le TEXTE égale la loi, canal par canal', () => {
  for (const b of balayage(40)) {
    for (const s of balayage(40)) {
      assert.equal(NUANCEUR.natSoftLight(b, s), softLight(b, s), `b=${b} s=${s}`)
    }
  }
  for (const c of balayage(20)) {
    for (const r of balayage(10)) {
      for (const g of balayage(10)) {
        for (const k of [0, 0.35, 0.6, 1]) {
          assert.equal(NUANCEUR.natPeigne(c, r, g, k), peigne(c, r, g, k), `c=${c} r=${r} g=${g} k=${k}`)
        }
      }
    }
  }
})

test('②e natVoile et natBrume : le TEXTE égale la loi', () => {
  for (const h of balayage(20)) {
    for (const fd of balayage(10)) {
      for (const amt of [0, 0.32, 0.45, 1]) {
        const v = NUANCEUR.natVoile(h, fd, amt, 0.5, 0.5)
        assert.equal(v, voile({ hNorm: h, fd, hazeAmt: amt, hazeAlt: 0.5, hazeDist: 0.5 }), `h=${h} fd=${fd}`)
        for (const c of balayage(8)) {
          assert.equal(
            NUANCEUR.natBrume(c, 0.42, v, 0.73, amt),
            brume({ col: c, lum: 0.42, veil: v, couleur: 0.73, hazeAmt: amt }),
            `c=${c} v=${v}`
          )
        }
      }
    }
  }
})

test('②f natLuminance porte EXACTEMENT les coefficients Rec. 709 du module', () => {
  // hors protocole canal-par-canal (dot mélange les canaux) : on EXTRAIT les
  // trois nombres du texte et on les confronte à la constante partagée.
  const m = GLSL_NATUREL.match(/float natLuminance\(vec3 c\) \{\s*return dot\(c, vec3\(([^)]*)\)\);/)
  assert.ok(m, 'natLuminance introuvable dans GLSL_NATUREL')
  assert.deepEqual(m[1].split(',').map((s) => Number(s.trim())), [...LUMA_709])
})

// ══════════ ③ UNE SEULE ÉCRITURE — L'ASSERTION QUI TIENT TOUT LE FICHIER ═══

test('③a les deux nuanceurs INJECTENT le module, ils ne le recopient pas', () => {
  assert.match(TERRAIN_SRC, /import \{ GLSL_NATUREL \} from '\.\/monde\/naturel-crop\.js'/)
  assert.match(GLOBE_SRC, /import \{ GLSL_NATUREL, NATUREL_MONDE \} from '\.\/monde\/naturel-crop\.js'/)
  assert.match(TERRAIN_SRC, /\$\{GLSL_NATUREL\}/)
  assert.match(GLOBE_SRC, /\$\{GLSL_NATUREL\}/)
})

test('③b AUCUNE des formules ne reparaît dans terrain.js ni dans globe.js', () => {
  // ⚠️ **C'EST L'ASSERTION QUI DISTINGUE UNE EXTRACTION D'UNE TRANSCRIPTION.**
  // Une transcription laisse deux écritures, et `terrain.js` porte déjà la
  // cicatrice de ce choix (« deux écritures jumelles finiraient par diverger »).
  // Ici les deux nuanceurs partagent le TEXTE : les formules ne doivent donc
  // exister qu'une fois, dans `naturel-crop.js`.
  //
  // ⚠️ Les commentaires sont RETIRÉS avant de chercher — c'est la leçon de la
  // Tâche K ter, dont une assertion trouvait la formule dans un pavé de prose.
  const sansCommentaires = (s) => s.replace(/\/\/[^\n]*/g, ' ').replace(/\/\*[\s\S]*?\*\//g, ' ')
  // ⚠️ **DEUX MOTIFS PAR FORMULE, ET CE N'EST PAS UN DOUBLON.** Le module écrit
  // ses formules sur des PARAMÈTRES (`treeLine`, `c`) là où les nuanceurs les
  // écrivaient sur des UNIFORMES (`uTreeLine`, `mapCol`). Un motif unique aurait
  // donc été soit trop lâche côté interdiction, soit introuvable côté module —
  // et « introuvable côté module » est le cas où le test ne garde plus rien.
  const FORMULES = [
    { quoi: 'le gain d’humidité', interdit: /4\.86\s*\*\s*veg/, present: /4\.86\s*\*\s*veg/ },
    { quoi: 'le polynôme du soft light', interdit: /\(16\.0\s*\*\s*b\s*-\s*12\.0\)/, present: /\(16\.0\s*\*\s*b\s*-\s*12\.0\)/ },
    { quoi: 'la bande de végétation', interdit: /uTreeLine\s*\+\s*0\.18/, present: /\btreeLine\s*\+\s*0\.18/ },
    // ⚠️ **LA CIBLE EST LA LUMINANCE DU VOILE, PAS TOUTE LUMINANCE Rec. 709.**
    // `terrain.js` en porte une autre, sans rapport (le `luma` de `fxShade`,
    // l. 977), et l'interdire globalement aurait fait crier ce test sur un poste
    // qui n'est pas le sien — un dénominateur qui déborde de sa question.
    { quoi: 'la luminance du voile', interdit: /dot\((?:mapCol|col),\s*vec3\(0\.2126/, present: /dot\(c,\s*vec3\(0\.2126/ },
    { quoi: 'le mélange du voile', interdit: /0\.6\s*\*\s*fa\s*\+/, present: /0\.6\s*\*\s*fa\s*\+/ },
    { quoi: 'le plancher de pivot', interdit: /clamp\([^)]*0\.95\)\s*\+\s*0\.02/, present: /clamp\([^)]*0\.95\)\s*\+\s*0\.02/ },
    { quoi: 'le gain du peigné', interdit: /-\s*0\.5\)\s*\*\s*3\.0,\s*0\.0,\s*1\.0\)/, present: /-\s*0\.5\)\s*\*\s*3\.0,\s*0\.0,\s*1\.0\)/ },
  ]
  for (const src of [sansCommentaires(TERRAIN_SRC), sansCommentaires(GLOBE_SRC)]) {
    for (const f of FORMULES) assert.ok(!f.interdit.test(src), `formule réécrite : ${f.quoi}`)
  }
  // ... et chacune existe bien UNE fois dans le module, sinon on ne garde rien
  for (const f of FORMULES) assert.ok(f.present.test(GLSL_NATUREL), `formule absente du module : ${f.quoi}`)
})

/** Le texte d'un fichier, commentaires de ligne retires. */
const sansComm = (t) => t.replace(/\/\/[^\n]*/g, ' ')

test('③c le socle APPELLE les fonctions partagées — il ne les a pas juste importées', () => {
  const sansCommentaires = TERRAIN_SRC.replace(/\/\/[^\n]*/g, ' ')
  for (const appel of ['natPlancherPivot(', 'natRampT(', 'natHumiditeY(', 'natPeigne(', 'natVoile(', 'natBrume(', 'natLuminance(']) {
    assert.ok(sansCommentaires.includes(appel), `terrain.js n'appelle pas ${appel}`)
  }
  // ⚠️ ET `fxBlend` mode 10 DÉLÈGUE au soft light partagé plutôt que de le
  // réécrire : c'était la SEULE autre écriture du soft light du dépôt.
  //
  // ⚠️ **`fxBlend` A DÉMÉNAGÉ — Tâche P3, et l'assertion le suit.** Les modes de
  // mélange vivent désormais dans `src/monde/melange-crop.js`, que `terrain.js`
  // ET `globe.js` injectent : le crop porte la couche Apparence, et cette couche
  // EST un mode de mélange. On exige les DEUX faits — la délégation dans le
  // module, et l'injection dans le socle — sans quoi une seconde écriture sur
  // place laisserait cette ligne verte.
  const melange = sansComm(readFileSync(new URL('../src/monde/melange-crop.js', import.meta.url), 'utf8'))
  assert.match(melange, /if \(m == 10\) return natSoftLight\(b, s\);/)
  assert.match(sansCommentaires, /\$\{GLSL_MELANGE\}/)
})

// ══════════ ④ LE BRANCHEMENT — LA FAIBLESSE RÉCURRENTE DU CHANTIER ═════════

test('④a `contexteCrop` transmet l’analyse ET la table du socle', () => {
  // ⛔ **C'ÉTAIT LE TROU.** `contexteCrop` ne portait AUCUNE texture d'analyse :
  // la richesse du socle était calculée, payée, et jetée à la porte du globe.
  const i = MAIN_SRC.indexOf('function contexteCrop()')
  assert.ok(i > 0, '`contexteCrop` introuvable')
  const bloc = MAIN_SRC.slice(i, MAIN_SRC.indexOf('\n}\n', i)).replace(/\/\/[^\n]*/g, ' ')
  assert.match(bloc, /terrain\.mapUniforms\.uAnalysisOn\.value > 0\.5 \? terrain\.mapUniforms\.uAnalysis\.value : null/)
  assert.match(bloc, /terrain\.mapUniforms\.uRampTex\.value \|\| null/)
  for (const champ of ['texShade', 'wetK', 'expoK', 'hemi', 'treeLine', 'heightContrast', 'heightPivot', 'hazeAmt', 'hazeAlt', 'hazeDist']) {
    assert.ok(bloc.includes(`${champ}: terrain.mapUniforms.u`), `${champ} ne traverse pas contexteCrop`)
  }
  // ⚠️ **LA COULEUR DE BRUME PASSE EN VALEUR, PAS EN OBJET** : `THREE.Color` est
  // muté en place par le socle, donc son identité ne changerait jamais.
  assert.match(bloc, /hazeColor: `#\$\{terrain\.mapUniforms\.uHazeColor\.value\.getHexString\(\)\}`/)
})

test('④b la veille SURVEILLE les treize champs neufs — sinon ils arrivent trop tard', () => {
  // ⚠️ **L'ANALYSE EST LE CHAMP LE PLUS EN RETARD DE LA LISTE** : elle sort d'un
  // travailleur, ~464 ms après la naissance du crop (mesure de `terrain.js`).
  // Sans surveillance, le peigné n'apparaîtrait qu'au prochain changement de
  // LIEU — la course que la Tâche K ter a nommée, en pire.
  for (const champ of ['analyse', 'rampe2D', 'texShade', 'wetK', 'expoK', 'hemi', 'treeLine', 'heightContrast', 'heightPivot', 'hazeAmt', 'hazeAlt', 'hazeDist', 'hazeColor']) {
    assert.ok(CHAMPS_HABILLAGE.includes(champ), `${champ} n'est pas surveillé`)
  }
  // et chacun, SEUL, déclenche une repose — le défaut « deux champs bougés
  // ensemble » que le second tour de la Tâche K ter a trouvé
  const pose = {}
  for (const c of CHAMPS_HABILLAGE) pose[c] = null
  assert.equal(habillageDifferent(pose, { ...pose }), false, 'un contexte identique repose quand même')
  for (const champ of CHAMPS_HABILLAGE) {
    assert.equal(habillageDifferent(pose, { ...pose, [champ]: 'autre' }), true, `${champ} bougé SEUL ne repose pas`)
  }
})

test('④c `poserHabillage` allume les deux interrupteurs — et SEULEMENT s’il y a de quoi', () => {
  const g = globeStub()
  Globe.prototype.poserHabillage.call(g, {})
  assert.equal(g.uniforms.uAnalysisOn.value, 0, 'allumé sans analyse')
  assert.equal(g.uniforms.uRampCropOn.value, 0, 'allumé sans table')
  const TEX = { nom: 'analyse' }
  const LUT = { nom: 'lut 2D' }
  // ⚠️ **CHAQUE CURSEUR EST POSÉ AVEC UNE VALEUR DISTINCTE DE SON DÉFAUT, ET
  // AUCUN N'EST OMIS.** La première rédaction n'en vérifiait que trois, et une
  // mutation qui figeait `uHemi` à 1 — donc qui renversait l'adret et l'ubac de
  // tout l'hémisphère SUD, où se trouve le lieu de référence du chantier —
  // SURVIVAIT. C'est exactement la faiblesse que ce chantier paie depuis cinq
  // tâches : le branchement testé à moitié.
  const REGLAGES = {
    texShade: 1, wetK: 0.96, expoK: 0.02, hemi: -1, treeLine: 0.92,
    heightContrast: 2.5, heightPivot: 0.65, hazeAmt: 0.32, hazeAlt: 0.4, hazeDist: 0.6,
  }
  Globe.prototype.poserHabillage.call(g, { analyse: TEX, rampe2D: LUT, ...REGLAGES, hazeColor: '#0a0b0c' })
  assert.equal(g.uniforms.uAnalysis.value, TEX)
  assert.equal(g.uniforms.uAnalysisOn.value, 1)
  assert.equal(g.uniforms.uRampCrop.value, LUT)
  assert.equal(g.uniforms.uRampCropOn.value, 1)
  for (const [cle, attendu] of Object.entries(REGLAGES)) {
    const nom = `u${cle[0].toUpperCase()}${cle.slice(1)}`
    assert.notEqual(attendu, NATUREL_MONDE[cle], `${cle} est posé à sa valeur par défaut : la mutation ne se verrait pas`)
    assert.equal(g.uniforms[nom].value, attendu, `${nom} n’est pas posé depuis l’argument ${cle}`)
  }
  assert.equal(g.uniforms.uHazeColor.value.hex, '#0a0b0c')
  // ⚠️ **LES DEUX INTERRUPTEURS SONT INDÉPENDANTS**, et ce n'est pas un luxe :
  // la table existe TOUJOURS (elle porte le pivot et le contraste, qui valent
  // dans les deux modes de couleur), l'analyse seulement en mode Naturel et
  // seulement une fois le travailleur revenu.
  Globe.prototype.poserHabillage.call(g, { rampe2D: LUT })
  assert.equal(g.uniforms.uAnalysisOn.value, 0)
  assert.equal(g.uniforms.uRampCropOn.value, 1)
})

test('④d `retirerHabillage` LÂCHE les deux textures et rend les curseurs', () => {
  const g = globeStub()
  Globe.prototype.poserHabillage.call(g, {
    analyse: { n: 1 }, rampe2D: { n: 2 }, texShade: 1, wetK: 0.96, expoK: 0.35,
    hemi: -1, treeLine: 0.9, heightContrast: 5.1, heightPivot: 0.53,
    hazeAmt: 0.32, hazeAlt: 0.4, hazeDist: 0.6, hazeColor: '#010203',
  })
  Globe.prototype.retirerHabillage.call(g)
  // ⚠️ LÂCHÉES, pas seulement débranchées : l'analyse d'un MNT 1536² pèse 12 Mo
  // mipmaps comprises, et un uniforme PARTAGÉ la garderait joignable.
  assert.equal(g.uniforms.uAnalysis.value, null)
  assert.equal(g.uniforms.uRampCrop.value, null)
  assert.equal(g.uniforms.uAnalysisOn.value, 0)
  assert.equal(g.uniforms.uRampCropOn.value, 0)
  for (const [nom, cle] of [
    ['uTexShade', 'texShade'], ['uWetK', 'wetK'], ['uExpoK', 'expoK'], ['uHemi', 'hemi'],
    ['uTreeLine', 'treeLine'], ['uHeightContrast', 'heightContrast'], ['uHeightPivot', 'heightPivot'],
    ['uHazeAmt', 'hazeAmt'], ['uHazeAlt', 'hazeAlt'], ['uHazeDist', 'hazeDist'],
  ]) {
    assert.ok(Object.is(g.uniforms[nom].value, NATUREL_MONDE[cle]), `${nom} non rendu`)
  }
  assert.equal(g.uniforms.uHazeColor.value.hex, NATUREL_MONDE.hazeColor)
})

test('④e le constructeur PREND ses valeurs dans NATUREL_MONDE — une seule écriture', () => {
  // ⚠️ MÊME DÉFAUT QUE `uContourInterval` AU TOUR 1 DE LA TÂCHE C : deux
  // littéraux jumeaux (le constructeur et `retirerHabillage`) divergent en
  // silence, et la planète entière garde le réglage d'un crop mort.
  const bloc = GLOBE_SRC.slice(GLOBE_SRC.indexOf('uAnalysis: { value: null }'), GLOBE_SRC.indexOf('uHazeColor: { value: new THREE.Color') + 200)
  for (const cle of ['texShade', 'wetK', 'expoK', 'hemi', 'treeLine', 'heightContrast', 'heightPivot', 'hazeAmt', 'hazeAlt', 'hazeDist', 'hazeColor']) {
    assert.ok(bloc.includes(`NATUREL_MONDE.${cle}`), `le constructeur recopie ${cle} au lieu de le lire`)
  }
  assert.match(GLOBE_SRC, /uAnalysisOn: \{ value: 0 \}/)
  assert.match(GLOBE_SRC, /uRampCropOn: \{ value: 0 \}/)
})

// ══════════ ⑤ LE NUANCEUR DU GLOBE — LES GARDES, EXÉCUTÉES ═════════════════

test('⑤a l’analyse est BORNÉE au crop — sinon La Réunion peigne les Andes', () => {
  // ⛔ **LE MÊME PIÈGE QUE `uFondChamp`, ET IL A DÉJÀ ÉTÉ VU À L'ÉCRAN** : la
  // Tâche K ter a relevé le masque de côte de La Réunion décidant de la terre et
  // de la mer SUR TOUTE LA SPHÈRE, par ClampToEdge. La texture d'analyse a
  // exactement la même forme.
  const i = FRAG_GLOBE.indexOf('anl = mix(')
  assert.ok(i > 0, 'la lecture de l’analyse est introuvable')
  const ligne = FRAG_GLOBE.slice(FRAG_GLOBE.lastIndexOf('\n', i), FRAG_GLOBE.indexOf(';', i))
  assert.match(ligne, /texture2D\(uAnalysis, qCrop \* 0\.5 \+ 0\.5\)/)
  assert.match(ligne, /dansCrop/)
  // et la borne est EXÉCUTÉE : hors du crop, le fondu rend le neutre
  const iB = FRAG_GLOBE.indexOf('float dansCrop = ')
  const exprBorne = FRAG_GLOBE.slice(iB + 'float dansCrop = '.length, FRAG_GLOBE.indexOf(';', iB))
  // eslint-disable-next-line no-new-func
  const borne = new Function('qCrop', 'STEP', `return (${exprBorne.replace(/\bstep\s*\(/g, 'STEP(').replace(/\bmax\s*\(/g, 'Math.max(').replace(/\babs\s*\(/g, 'Math.abs(')});`)
  for (const [x, y, attendu] of [[0, 0, 1], [0.99, -0.99, 1], [1, 1, 1], [1.01, 0, 0], [0, -1.5, 0], [40, 40, 0]]) {
    assert.equal(borne({ x, y }, STEP), attendu, `qCrop=(${x}, ${y})`)
  }
})

test('⑤b le peigné et le voile ne mordent QUE sur la terre, et sous garde d’uniforme', () => {
  // ⚠️ **TERRE SEULE, COMME DANS LE SOCLE** : la branche sous-marine de
  // `terrain.js` ne voit jamais ce bloc. Peigner le fond marin y graverait des
  // crêtes que la bathymétrie ne porte pas.
  //
  // ⚠️ **LES COMMENTAIRES SONT RETIRÉS AVANT DE CHERCHER, ET CE N'EST PAS UNE
  // COQUETTERIE** : la première rédaction de ce test découpait une fenêtre de
  // 300 caractères avant l'appel, et le pavé qui EXPLIQUE la garde est tombé
  // dedans. C'est mot pour mot la survivante que la Tâche K ter a trouvée — une
  // assertion verte parce qu'elle lisait de la prose.
  const gardeDe = (appel) => {
    const i = FRAG_NU.indexOf(appel)
    assert.ok(i > 0, `${appel} introuvable dans le nuanceur`)
    const j = FRAG_NU.lastIndexOf('if (', i)
    return FRAG_NU.slice(j, FRAG_NU.indexOf(')', FRAG_NU.indexOf('{', j) - 2) + 1)
  }
  assert.match(gardeDe('col = natPeigne('), /if \(uAnalysisOn > 0\.5 && uTexShade > 0\.001 && !sousEau\)/)
  assert.match(gardeDe('float veil = natVoile('), /if \(uRampCropOn > 0\.5 && uHazeAmt > 0\.001 && !sousEau\)/)
  assert.match(gardeDe('float rampT = natRampT('), /if \(uRampCropOn > 0\.5 && !sousEau\)/)
})

test('⑤c la distance du voile est length(qCrop) — la MÊME grandeur que celle du socle', () => {
  // ⚠️ **CE N'EST PAS UNE APPROXIMATION** : `terrain.js` divise par `uSlabHalf`
  // (28) une distance en unités de scène, et l'en-tête de `habillage-crop.js`
  // DÉMONTRE `x = 28 · u`. Le quotient EST `qCrop`, terme à terme.
  assert.match(FRAG_GLOBE, /float fd = clamp\(length\(qCrop\), 0\.0, 1\.0\);/)
  assert.match(TERRAIN_SRC, /float fd = clamp\(length\(vWorldPos\.xz - uBlockOffset\) \/ max\(uSlabHalf, 1e-3\), 0\.0, 1\.0\);/)
})

test('⑤d le pivot, la limite des arbres et le voile lisent hNormRelief — l’échelle DU SOCLE', () => {
  // ⛔ **LA FAUTE QUE LA COMPARAISON APPARIÉE A RÉVÉLÉE, ET ELLE EST CHIFFRÉE.**
  // Le socle normalise sur `uHeightRange`, l'amplitude COMPLÈTE de son MNT, FOND
  // MARIN COMPRIS : relevé dans l'application vivante (La Réunion z12), il couvre
  // −2 116 → 2 626 m, donc le niveau de la mer y tombe à **hNorm = 0,4462**, pas
  // à zéro. `uHeightPivot` (0,65) et `uTreeLine` (0,92) sont des réglages POSÉS
  // DANS CETTE ÉCHELLE. Les appliquer au `hNorm` de la Tâche D — qui part du
  // minimum de la TERRE, donc met la mer à zéro — rendait `natRampT = 0` pour
  // TOUT ce qui est sous **1 163 m** (un aplat olive sur toute l'île) là où le
  // socle étale déjà 0 → 0,78 sur la même tranche.
  const i = FRAG_GLOBE.indexOf('float hNormRelief = ')
  assert.ok(i > 0, 'hNormRelief est introuvable dans le nuanceur du globe')
  const expr = FRAG_GLOBE.slice(i + 'float hNormRelief = '.length, FRAG_GLOBE.indexOf(';', i))
  // ⛔ **ET L'ANCRE BASSE N'EST PLUS `-uOceanDepth` — Tâche P11.** Voir ⑤d bis :
  // cette écriture-là n'était juste que sur un crop AVEC MER.
  assert.match(expr, /clamp\(\(h - uReliefBas\) \/ max\(uLandMax - uReliefBas, uPlancherRampeM\), 0\.0, 1\.0\)/)
  // ⚠️ **ET IL EST EXÉCUTÉ, PAS SEULEMENT LU.** On rejoue les DEUX conventions
  // sur les valeurs relevées et on exige que celle du nuanceur suive le socle.
  const SOCLE = { min: -2116, max: 2626 } // uHeightRange, relevé le 2026-08-22
  const G = { landBas: 0, landMax: 2584.3525390625, oceanDepth: 2106.7706909179688 }
  const cl = (v) => Math.min(Math.max(v, 0), 1)
  const hSocle = (m) => cl((m - SOCLE.min) / (SOCLE.max - SOCLE.min))
  const hTerre = (m) => cl((m - G.landBas) / (G.landMax - G.landBas))
  // ⚡ **CE CROP-LÀ A DE LA MER** : son `minM` vaut −2 106,8, donc `terreBas −
  // creux` et `−profondeur` désignent le MÊME nombre. C'est la raison pour
  // laquelle l'écriture d'avant passait ici — et ⑤d bis dit où elle ne passe pas.
  const reliefBas = G.landBas - G.oceanDepth
  const hRelief = (m) => cl((m - reliefBas) / (G.landMax - reliefBas))
  for (const m of [0, 200, 500, 1000, 1500, 2000]) {
    const cible = rampeT(hSocle(m), 0.65, 2.5)
    const bon = rampeT(hRelief(m), 0.65, 2.5)
    const faux = rampeT(hTerre(m), 0.65, 2.5)
    assert.ok(Math.abs(bon - cible) < 0.02, `${m} m : hNormRelief donne ${bon}, le socle ${cible}`)
    if (m > 0 && m < 2000) assert.ok(Math.abs(faux - cible) > 0.05, `${m} m : les deux conventions ne se distinguent pas — le test ne prouve rien`)
  }
  // le plancher du pivot suit la MÊME conversion : la mer est à h = 0
  assert.match(FRAG_GLOBE, /natPlancherPivot\(\(0\.0 - uReliefBas\) \/ max\(uLandMax - uReliefBas, uPlancherRampeM\)\)/)
  assert.ok(Math.abs(plancherPivot((0 - reliefBas) / (G.landMax - reliefBas)) - plancherPivot(hSocle(0))) < 0.01)
  // et un pivot d'utilisateur plus haut que le plancher gagne — c'est un réglage
  assert.equal(Math.max(0.65, plancherPivot(hSocle(0))), 0.65)
  assert.equal(plancherPivot(0), MARGE_PIVOT)
  // les trois lecteurs de l'échelle du socle emploient hNormRelief, aucun hNorm
  for (const appel of ['natRampT(hNormRelief,', 'natHumiditeY(anl.b, anl.a, hNormRelief,', 'natVoile(hNormRelief,']) {
    assert.ok(FRAG_GLOBE.includes(appel), `${appel} : un lecteur est resté sur l’échelle de la Tâche D`)
  }
})

test('⑤d bis SUR UN CROP SANS MER, `-uOceanDepth` N’EST PAS LE MINIMUM DU RELIEF — Tâche P11', () => {
  // ⛔ **⑤d ÉTAIT VERT PARCE QU'IL NE TESTAIT QU'UNE BRANCHE.** Son crop de
  // référence a de la mer (`minM = −2 106,8`), et là `−profondeur` EST le
  // minimum du relief. Sur un crop ENTIÈREMENT TERRESTRE, `echelleRampe` rend
  // `profondeur = plancherM` (un aveu), `echelle-continue.js` §4 refuse de
  // l'ancrer, et l'uniforme garde la valeur MONDIALE de 6 000 m.
  //
  // ⚡ **CE N'EST PAS UNE HYPOTHÈSE : C'EST LE RELEVÉ DU 2026-08-23**, La Réunion
  // cadrage intérieur (lat −21,115 · lon 55,536, z12), page vivante, socle
  // rallumé dans la même page (`.banc/P11/D2-ancre-basse-P11.json`) :
  //   · posé      : uLandBas 130 · uLandMax 3 026 · uOceanDepth **6 000**
  //   · mesuré    : terreBas 107,46 · terreHaut 3 009,64 · profondeur **0,0175**
  //   · socle     : uHeightRange [−4,945 ; 7,161] unités, uSeaY −5,409 —
  //                 c'est-à-dire un MNT dont le minimum est AU-DESSUS de la mer.
  const SOCLE = { min: 111, max: 3010 } // dem.minM / dem.maxM, dérivés d'uHeightRange et d'uSeaY
  const CROP = { landBas: 130, landMax: 3026, oceanDepth: 6000, creux: 0 }
  const cl = (v) => Math.min(Math.max(v, 0), 1)
  const hSocle = (m) => cl((m - SOCLE.min) / (SOCLE.max - SOCLE.min))
  const avant = (m) => cl((m + CROP.oceanDepth) / (CROP.landMax + CROP.oceanDepth))
  const bas = CROP.landBas - CROP.creux
  // ⚡ **`apres` N'EST PAS RÉÉCRITE ICI : ELLE EST EXTRAITE DU NUANCEUR ET
  // EXÉCUTÉE.** Une assertion de texte serait verte le jour où quelqu'un écrit
  // l'expression dans un commentaire ; celle-ci meurt si le GPU calcule autre
  // chose. (Le protocole est celui de `test/crop-rampe.test.js` ②b.)
  const i2 = FRAG_GLOBE.indexOf('float hNormRelief = ')
  const brut = FRAG_GLOBE.slice(i2 + 'float hNormRelief = '.length, FRAG_GLOBE.indexOf(';', i2))
  const js = brut.replace(/\bclamp\s*\(/g, 'CL3(').replace(/\bmax\s*\(/g, 'Math.max(')
  // eslint-disable-next-line no-new-func
  const duNuanceur = new Function('h', 'uReliefBas', 'uLandMax', 'uPlancherRampeM', 'CL3', `return (${js});`)
  const apres = (m) => duNuanceur(m, bas, CROP.landMax, 0.0175, (v, a, b) => Math.min(Math.max(v, a), b))
  assert.ok(Math.abs(apres(1000) - cl((1000 - bas) / (CROP.landMax - bas))) < 1e-12, "l'expression extraite ne dit pas la loi")
  // les deux pivots-planchers, dans les deux conventions
  const pivotAvant = Math.max(0.41, plancherPivot(CROP.oceanDepth / (CROP.landMax + CROP.oceanDepth)))
  const pivotApres = Math.max(0.41, plancherPivot((0 - bas) / (CROP.landMax - bas)))
  const pivotSocle = Math.max(0.41, plancherPivot(hSocle(0)))
  assert.ok(Math.abs(pivotAvant - pivotSocle) > 0.25, `le pivot d'avant valait ${pivotAvant}, celui du socle ${pivotSocle}`)
  assert.ok(Math.abs(pivotApres - pivotSocle) < 1e-9, `le pivot d'après vaut ${pivotApres}`)
  // ⚡ ET LA RAMPE ELLE-MÊME : l'écriture d'avant ne descend JAMAIS sous 0,45,
  // celle d'après suit le socle à deux centièmes sur toute l'île.
  let minAvant = 1
  for (const m of [0, 200, 500, 800, 1200, 1800, 2400, 3000]) {
    const cible = rampeT(hSocle(m), pivotSocle, 2.2)
    const bon = rampeT(apres(m), pivotApres, 2.2)
    const faux = rampeT(avant(m), pivotAvant, 2.2)
    if (faux < minAvant) minAvant = faux
    assert.ok(Math.abs(bon - cible) < 0.02, `${m} m : la loi P11 donne ${bon}, le socle ${cible}`)
  }
  assert.ok(minAvant > 0.44, `⛔ l'écriture d'avant descendait jusqu'à ${minAvant} — elle atteignait la moitié basse`)
  assert.equal(rampeT(hSocle(0), pivotSocle, 2.2), 0, 'le socle, lui, part bien du bas de sa table')
})

// --- le stub, en fin de fichier : il n'est utile qu'aux tests ④

const val = (v) => ({ value: v })
const vecStub = () => ({ x: 0, y: 0, z: 0, set() { return this }, fromArray() { return this }, normalize() { return this }, copy() { return this } })
const couleurStub = () => ({ set() {}, setStyle() {} })
function globeStub() {
  return {
    _crop: null,
    uniforms: {
      uHabOn: val(0), uCoastMask: val(null), uCoastMaskOn: val(0), uMargeCoteM: val(0),
      uSol: val(null), uSolLut: val(null), uSolOn: val(0), uSolOpacite: val(1),
      uSolOffset: val({ set() {} }), uSolScale: val({ set() {} }), uSolTexel: val({ set() {} }),
      uContourInterval: val(500), uContourOpacity: val(0.55), uContourWeight: val(0.7),
      uGrainForceM: val(0), uGrainEchelle: val(96), uNormaleFineOn: val(0),
      uAnalysis: val(null), uAnalysisOn: val(0),
      uTexShade: val(NATUREL_MONDE.texShade), uWetK: val(NATUREL_MONDE.wetK),
      uExpoK: val(NATUREL_MONDE.expoK), uHemi: val(NATUREL_MONDE.hemi),
      uTreeLine: val(NATUREL_MONDE.treeLine),
      uRampCrop: val(null), uRampCropOn: val(0),
      uHeightContrast: val(NATUREL_MONDE.heightContrast), uHeightPivot: val(NATUREL_MONDE.heightPivot),
      uHazeAmt: val(NATUREL_MONDE.hazeAmt), uHazeAlt: val(NATUREL_MONDE.hazeAlt),
      uHazeDist: val(NATUREL_MONDE.hazeDist),
      uHazeColor: val({ hex: NATUREL_MONDE.hazeColor, set(v) { this.hex = v } }),
      // ══════ L'ÉCLAIRAGE ET LA COUCHE APPARENCE — Tâche P3 ═══════════════
      // Ce stub n'exerce que ④ : il lui suffit de PORTER les uniformes que
      // `poserHabillage` écrit. Leur aller-retour bit à bit est vérifié par
      // `crop-habillage` ⑨h et par `crop-eclairage` ④d.
      uEclairageOn: val(0),
      uSoleilDir: val(vecStub()), uSoleilIrr: val(vecStub()),
      uHemiHaut: val(vecStub()), uCielIrr: val(vecStub()), uSolIrr: val(vecStub()),
      uParoiCielIrr: val(vecStub()), uParoiSolIrr: val(vecStub()),
      uAlbedoBase: val(vecStub()), uAlbedoTeinte: val(1),
      uParoiCouleur: val(couleurStub()),
      uSurfaceFx: val(0), uFxBlend: val(0), uFxOpacite: val(0), uFxScale: val(1), uFxTime: val(0),
      uFxColA: val(couleurStub()), uFxColB: val(couleurStub()), uFxColC: val(couleurStub()),
      uFxP1: val(0), uFxP2: val(0), uFxP3: val(0),
      uFxDemiBloc: val(28), uFxFenetre: val({ set() {} }),
    },
  }
}

test('⑤e sans crop, `smoothstep` du module et celui du GLSL parlent la même langue', () => {
  // ⚠️ **LE JUMEAU JS DOIT ÊTRE LE MÊME `smoothstep` QUE LE GPU**, sinon toute la
  // section ② compare deux erreurs. On confronte donc l'implémentation du module
  // à celle du transpileur, qui est écrite séparément.
  for (const x of balayage(200)) {
    assert.ok(Math.abs(smoothstep(0.2, 0.8, x * 1.4 - 0.2) - SMOOTHSTEP(0.2, 0.8, x * 1.4 - 0.2)) < 1e-15, `x=${x}`)
  }
})
