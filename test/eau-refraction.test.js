// LA RÉFRACTION DE LA LAME D'EAU — Tâche R2 du plan « UNE SEULE TERRE »
// (`docs/superpowers/plans/2026-08-22-globe-studio.md`).
//
// ══════════ CE QUE CE FICHIER VÉRIFIE, ET CE QU'IL NE PEUT PAS ══════════════
//
// Même protocole que `crop-naturel` et `crop-eclairage` :
//   ① LA LOI vit dans un module PUR et se vérifie sous node, point par point ;
//   ② LE TEXTE GLSL est **TRADUIT ET EXÉCUTÉ**, jamais cherché par son nom ;
//   ③ **L'UNICITÉ DE L'ÉCRITURE** est elle-même une assertion ;
//   ④ le BRANCHEMENT — un uniforme déclaré et lu par personne est le défaut que
//      ce chantier a rencontré cinq fois (`uCropCoin`, `uMerSoleilFx`, …) ;
//   ⑤ **LE REPÈRE DE LA NORMALE**, la garde qui manquait et qui a coûté un
//      facteur 16,4 sur le Fresnel de la mer du crop.
//
// ⚠️ **CE QUI RESTE HORS DE PORTÉE, ET IL FAUT LE DIRE** : que le GPU exécute ce
// texte, que la copie du tampon d'image ne soit pas noire, et que l'image
// ressemble à celle du socle. **Aucune assertion d'ici ne le prouve.** Les
// assertions ③ ④ ⑤ lisent le TEXTE SOURCE : elles constatent qu'une écriture
// existe, elles ne constatent pas qu'elle rend une image. Seul l'écran le dit —
// c'est `.banc/R2/` et le rapport de la tâche.

import test from 'node:test'
import assert from 'node:assert/strict'
import { readFileSync } from 'node:fs'

import {
  REFRACTION,
  REFRACTION_NEUTRE,
  decalageRefraction,
  uvRefractee,
  composeLameEau,
  refractionDuSocle,
  GLSL_REFRACTION,
} from '../src/monde/eau-refraction.js'

const OCEAN_SRC = readFileSync(new URL('../src/ocean.js', import.meta.url), 'utf8')
const GLOBE_SRC = readFileSync(new URL('../src/globe.js', import.meta.url), 'utf8')
const MAIN_SRC = readFileSync(new URL('../src/main.js', import.meta.url), 'utf8')
const ECUME_SRC = readFileSync(new URL('../src/monde/ecume-mer.js', import.meta.url), 'utf8')

/** Un texte SANS ses commentaires — la Tâche K ter a trouvé une assertion verte
 *  parce qu'elle lisait une formule DANS un commentaire. */
const sansComm = (s) => s.replace(/\/\/[^\n]*/g, '').replace(/\/\*[\s\S]*?\*\//g, '')

const OCEAN_NU = sansComm(OCEAN_SRC)
const GLOBE_NU = sansComm(GLOBE_SRC)

// ══════════ L'OUTILLAGE — TRADUIRE LE GLSL, PUIS L'EXÉCUTER ════════════════

const CLAMP = (x, a, b) => Math.min(Math.max(x, a), b)
const MIX = (a, b, t) => a + (b - a) * t

/**
 * Le TEXTE de `GLSL_REFRACTION`, rendu exécutable en JS — composante par
 * composante. ⚠️ **AUCUNE FORMULE N'EST RÉÉCRITE ICI** : seuls les MOTS du
 * langage sont remplacés. Si une constante du nuanceur change, la traduction la
 * porte, et la comparaison au jumeau JS tombe.
 *
 * Les trois fonctions du module sont TOUTES composante par composante (`mix`,
 * `clamp` et le produit par un scalaire le sont), donc les exécuter sur des
 * scalaires est exact — c'est le protocole de `crop-naturel`.
 */
function traduire(glsl) {
  return glsl
    .replace(/\/\/[^\n]*/g, '')
    .replace(/\b(?:float|vec2|vec3)\s+(\w+)\s*\(([^)]*)\)\s*\{/g, (_, nom, args) => {
      const noms = args
        .split(',')
        .map((a) => a.trim().split(/\s+/).pop())
        .filter(Boolean)
      return `function ${nom}(${noms.join(', ')}) {`
    })
    .replace(/\bvec2\s*\(/g, '(')
    .replace(/\bvec3\s*\(/g, '(')
    .replace(/\bclamp\s*\(/g, 'CLAMP(')
    .replace(/\bmix\s*\(/g, 'MIX(')
}

const JS_REFRACTION = traduire(GLSL_REFRACTION)
// eslint-disable-next-line no-new-func
const NUANCEUR = new Function(
  'CLAMP',
  'MIX',
  `${JS_REFRACTION}
   return { decalageRefraction, uvRefractee, composeLameEau }`
)(CLAMP, MIX)

/** Un balayage reproductible — pas de hasard, donc pas de test qui clignote. */
function* balayage(n = 23) {
  for (let i = 0; i <= n; i++) yield i / n
}

// ══════════ ① LA LOI PURE ═══════════════════════════════════════════════════

test('① les cinq constantes sont celles d’ocean.js, figées ici', () => {
  // ⚠️ **LEUR ORIGINE EST DANS L'HISTOIRE, PLUS DANS `ocean.js`** — c'est le prix
  // d'une extraction : le littéral n'y est plus, il est ICI. Avant la Tâche R2,
  // `ocean.js` portait `refOff = N.xz * uRefract * 0.09 * (0.3 + 0.7 * vFade)` et
  // `clamp(screenUv + refOff, vec2(0.001), vec2(0.999))`. Ces cinq nombres sont
  // ces deux lignes, et rien d'autre ne doit les déplacer en silence.
  assert.deepEqual({ ...REFRACTION }, {
    gain: 0.09,
    plancherRive: 0.3,
    poidsRive: 0.7,
    borne: 0.999,
    borneBasse: 0.001,
  })
  // et le texte GLSL les porte VRAIMENT, pas des arrondis voisins
  assert.match(GLSL_REFRACTION, /\* 0\.09 \* \(0\.3 \+ 0\.7 \* fonduRive\)/)
  assert.match(GLSL_REFRACTION, /clamp\(uv \+ decalage, vec2\(0\.001\), vec2\(0\.999\)\)/)
})

test('① le neutre est le `??` du dépôt, pas un nombre choisi', () => {
  // ⚠️ `ocean.js` ne porte plus le littéral : il porte le NOM. C'est le point de
  // l'extraction — un seul `0.6` dans le dépôt, celui de `params`.
  assert.match(OCEAN_NU, /uRefract:\s*\{\s*value:\s*params\.seaRefract\s*\?\?\s*REFRACTION_NEUTRE\s*\}/)
  assert.match(OCEAN_NU, /uRefract\.value\s*=\s*params\.seaRefract\s*\?\?\s*REFRACTION_NEUTRE/)
  assert.match(MAIN_SRC, new RegExp(`seaRefract:\\s*${REFRACTION_NEUTRE}\\b`))
})

test('① le décalage suit la force DANS LES DEUX SENS, et s’annule à force nulle', () => {
  const pente = [0.3, -0.2]
  const zero = decalageRefraction(pente, 0, 1)
  assert.deepEqual(zero, [0, 0])
  let precedent = 0
  for (const t of balayage()) {
    const d = decalageRefraction(pente, t, 1)
    const norme = Math.hypot(d[0], d[1])
    assert.ok(norme >= precedent, 'le décalage doit croître avec la force')
    precedent = norme
  }
  // et il DÉCROÎT quand on redescend : une concordance au défaut n'est pas un
  // branchement, il faut déplacer la valeur dans les deux sens.
  assert.ok(Math.hypot(...decalageRefraction(pente, 0.2, 1)) < Math.hypot(...decalageRefraction(pente, 0.9, 1)))
})

test('① le plancher de rive est un PLANCHER : au large la réfraction reste vivante', () => {
  const pente = [1, 0]
  const large = decalageRefraction(pente, 1, 0)[0]
  const cote = decalageRefraction(pente, 1, 1)[0]
  assert.ok(large > 0, 'au large (fondu 0) la réfraction ne doit PAS s’éteindre')
  assert.equal(large, REFRACTION.gain * REFRACTION.plancherRive)
  assert.equal(cote, REFRACTION.gain * (REFRACTION.plancherRive + REFRACTION.poidsRive))
  assert.ok(cote > large)
})

test('① le décalage est SANS DIMENSION : il ne connaît que des normales unitaires', () => {
  // ⚠️ C'est l'invariant d'unités de l'Étape 5 : la MÊME pente donne le MÊME
  // décalage, que le bloc vive en unités de bloc (56) ou en unités-monde du
  // globe. Rien dans la loi ne porte une longueur.
  const pente = [0.42, 0.17]
  const a = decalageRefraction(pente, 0.6, 0.5)
  // « le crop en unités-monde » : la même pente, exprimée à l'identique
  const b = decalageRefraction([...pente], 0.6, 0.5)
  assert.deepEqual(a, b)
  // et aucune constante du module n'est une longueur : les quatre sont dans [0, 1]
  for (const [nom, v] of Object.entries(REFRACTION)) {
    assert.ok(v > 0 && v <= 1, `${nom} devrait être un nombre sans dimension dans ]0, 1]`)
  }
})

test('① les UV réfractées ne sortent JAMAIS du tampon copié', () => {
  for (const t of balayage()) {
    for (const s of [-1, 1]) {
      const uv = uvRefractee([t, 1 - t], [s * 5, s * -5])
      assert.ok(uv[0] >= REFRACTION.borneBasse && uv[0] <= REFRACTION.borne)
      assert.ok(uv[1] >= REFRACTION.borneBasse && uv[1] <= REFRACTION.borne)
    }
  }
})

test('① le composite : à opacité nulle on voit le FOND, à opacité pleine le CORPS', () => {
  const travers = [0.1, 0.2, 0.3]
  const corps = [0.7, 0.5, 0.4]
  assert.deepEqual(composeLameEau(travers, corps, 0), travers)
  assert.deepEqual(composeLameEau(travers, corps, 1), corps)
  // et il est monotone entre les deux
  let precedent = travers[0]
  for (const t of balayage()) {
    const c = composeLameEau(travers, corps, t)[0]
    assert.ok(c >= precedent - 1e-12)
    precedent = c
  }
})

// ══════════ ② LE TEXTE GLSL, TRADUIT PUIS EXÉCUTÉ ══════════════════════════

test('② le GLSL traduit ne porte plus un seul type du langage', () => {
  assert.doesNotMatch(JS_REFRACTION, /\b(?:float|vec2|vec3|sampler2D|uniform|varying)\b/)
})

test('② decalageRefraction : le texte GLSL rend le jumeau JS, sur tout le balayage', () => {
  for (const p of balayage(11)) {
    for (const f of balayage(11)) {
      for (const r of balayage(11)) {
        const pente = p * 2 - 1
        const attendu = decalageRefraction([pente, 0], f, r)[0]
        const obtenu = NUANCEUR.decalageRefraction(pente, f, r)
        assert.ok(Math.abs(obtenu - attendu) < 1e-12, `pente ${pente} force ${f} rive ${r}`)
      }
    }
  }
})

test('② uvRefractee : le texte GLSL rend le jumeau JS', () => {
  for (const u of balayage(17)) {
    for (const d of [-0.5, -0.02, 0, 0.02, 0.5]) {
      assert.equal(NUANCEUR.uvRefractee(u, d), uvRefractee([u, u], [d, d])[0])
    }
  }
})

test('② composeLameEau : le texte GLSL rend le jumeau JS', () => {
  for (const t of balayage(13)) {
    for (const o of balayage(13)) {
      assert.ok(Math.abs(NUANCEUR.composeLameEau(t, 1 - t, o) - composeLameEau([t], [1 - t], o)[0]) < 1e-12)
    }
  }
})

// ══════════ ③ L'UNICITÉ DE L'ÉCRITURE ══════════════════════════════════════
//
// ⚠️ **CES ASSERTIONS LISENT LE TEXTE SOURCE ET NE PROUVENT AUCUN RENDU.** Elles
// interdisent la SECONDE écriture, ce qui est exactement leur objet : le défaut
// que `terrain.js` appelle « deux écritures jumelles ».

test('③ les deux nuanceurs INJECTENT le module — ils ne le recopient pas', () => {
  assert.match(OCEAN_SRC, /import \{[^}]*GLSL_REFRACTION[^}]*\} from '\.\/monde\/eau-refraction\.js'/)
  assert.match(GLOBE_SRC, /import \{[^}]*GLSL_REFRACTION[^}]*\} from '\.\/monde\/eau-refraction\.js'/)
  assert.match(OCEAN_SRC, /\$\{GLSL_REFRACTION\}/)
  assert.match(GLOBE_SRC, /\$\{GLSL_REFRACTION\}/)
})

test('③ aucune formule de réfraction n’est réécrite hors du module', () => {
  const FORMULES = [
    { quoi: 'le gain et le plancher de rive', motif: /\*\s*0\.09\s*\*\s*\(\s*0\.3\s*\+\s*0\.7\s*\*/ },
    { quoi: 'la borne d’échantillonnage', motif: /vec2\(0\.001\)\s*,\s*vec2\(0\.999\)/ },
  ]
  for (const f of FORMULES) {
    assert.ok(f.motif.test(GLSL_REFRACTION), `formule absente du module : ${f.quoi}`)
    for (const [nom, src] of [['ocean.js', OCEAN_NU], ['globe.js', GLOBE_NU]]) {
      assert.ok(!f.motif.test(src), `${nom} réécrit ${f.quoi} au lieu de l’injecter`)
    }
  }
})

test('③ le fondu de rive est la MÊME loi des deux côtés, pas deux transcriptions', () => {
  // `ocean.js` : `vFade = fonduRessacMer(shoreD)` — `globe.js` :
  // `vFonduRive = fonduRessacMer(declin)`. C'est ce qui autorise à transcrire
  // `(0.3 + 0.7 * vFade)` en `(0.3 + 0.7 * vFonduRive)` SANS conversion.
  assert.match(ECUME_SRC, /float fonduRessacMer\(float declin\)/)
  assert.match(OCEAN_NU, /vFade\s*=\s*fonduRessacMer\(/)
  assert.match(GLOBE_NU, /vFonduRive\s*=\s*fonduRessacMer\(/)
  assert.match(GLOBE_NU, /decalageRefraction\(\s*[\w.]+\s*,\s*uMerRefract\s*,\s*vFonduRive\s*\)/)
})

// ══════════ ④ LE BRANCHEMENT ═══════════════════════════════════════════════

test('④ la force de réfraction du crop est LUE sur le socle, pas redérivée', () => {
  // ⚠️ **LE LECTEUR VIT DANS `eau-refraction.js`, PAS DANS `ecume-mer.js`** — et
  // c'est un invariant du dépôt qui l'impose : `test/ecume-mer.test.js` ③c exige
  // que `ecume-mer.js` n'ait AUCUNE importation. Un cinquième réglage de lame y
  // aurait donc recopié le `0,6`, c'est-à-dire exactement ce qu'on refuse.
  assert.ok(!/^\s*import\s/m.test(ECUME_SRC), 'ecume-mer.js doit rester sans importation')
  assert.match(OCEAN_NU, /refraction: refractionDuSocle\(u\),/)
  assert.match(GLOBE_NU, /u\.uMerRefract\.value = Number\.isFinite\(reglages\?\.refraction\)/)
  // et le neutre est celui du module, pas un littéral de plus
  assert.match(GLOBE_NU, /uMerRefract: \{ value: REFRACTION_NEUTRE \}/)
  // le lecteur LIT, dans les deux sens, et retombe sur le neutre
  assert.equal(refractionDuSocle({ uRefract: { value: 0.34 } }), 0.34)
  assert.equal(refractionDuSocle({ uRefract: { value: 0.91 } }), 0.91)
  assert.equal(refractionDuSocle({ uRefract: { value: NaN } }), REFRACTION_NEUTRE)
  assert.equal(refractionDuSocle(null), REFRACTION_NEUTRE)
})

test('④ les trois uniformes neufs du crop sont DÉCLARÉS et LUS', () => {
  const FRAG = GLOBE_NU.slice(GLOBE_NU.indexOf('const MER_FRAG'), GLOBE_NU.indexOf('const CIRCONFERENCE_MERCATOR'))
  for (const nom of ['uMerScene', 'uMerResolution', 'uMerRefract', 'uMerVersMonde']) {
    assert.match(FRAG, new RegExp(`uniform\\s+\\w+\\s+${nom};`), `${nom} n'est pas déclaré`)
    const lectures = FRAG.split(nom).length - 1
    assert.ok(lectures >= 2, `${nom} est déclaré et lu par personne (${lectures} occurrence)`)
    assert.match(GLOBE_NU, new RegExp(`${nom}:\\s*\\{`), `${nom} n'est pas posé à la construction`)
  }
})

// ══════════ ⑤ LE REPÈRE DE LA NORMALE — LA GARDE QUI MANQUAIT ══════════════

test('⑤ le Fresnel du crop dote une normale en repère MONDE, pas en repère local', () => {
  const FRAG = GLOBE_NU.slice(GLOBE_NU.indexOf('const MER_FRAG'), GLOBE_NU.indexOf('const CIRCONFERENCE_MERCATOR'))
  // la normale locale existe toujours — c'est elle que la réfraction prend
  assert.match(FRAG, /vec3 nLocal = clapotNormale\(normalize\(vNormMer\)/)
  // et la normale du Fresnel PASSE par la rotation du crop
  assert.match(FRAG, /vec3 N = normalize\(uMerVersMonde \* nLocal\)/)
  // ⛔ et `vNormMer` ne doit plus arriver NU dans un produit scalaire avec V
  assert.ok(!/dot\(\s*normalize\(vNormMer\)/.test(FRAG), 'la normale locale est encore dotée telle quelle')
})

test('⑤ la réfraction prend la pente LOCALE — celle du repère de la nappe', () => {
  const FRAG = GLOBE_NU.slice(GLOBE_NU.indexOf('const MER_FRAG'), GLOBE_NU.indexOf('const CIRCONFERENCE_MERCATOR'))
  assert.match(FRAG, /decalageRefraction\(nLocal\.xz,/)
  // ⚠️ et le socle prend `N.xz`, qui est la MÊME paire dans SON repère : son
  // « haut » est celui du monde parce que sa mer est un plan horizontal.
  assert.match(OCEAN_NU, /decalageRefraction\(N\.xz,\s*uRefract,\s*vFade\)/)
})

test('⑤ la matrice de repère est POSÉE depuis la matrice monde de la mer', () => {
  assert.match(GLOBE_NU, /uMerVersMonde\.value\.setFromMatrix4\(/)
})

// ══════════ ⑥ L'ORDRE DU COMPOSITE ═════════════════════════════════════════

test('⑥ les reflets de surface arrivent APRÈS le composite, des deux côtés', () => {
  for (const [nom, src, marqueur] of [
    ['ocean.js', OCEAN_NU, 'composeLameEau('],
    ['globe.js', GLOBE_NU, 'composeLameEau('],
  ]) {
    const iComposite = src.indexOf(marqueur)
    assert.ok(iComposite > 0, `${nom} ne compose pas la lame d'eau`)
    const iCiel = src.indexOf('uSky, fres * 0.35', iComposite)
    assert.ok(iCiel > iComposite, `${nom} pose le reflet de ciel AVANT le composite`)
  }
})

test('⑥ l’alpha du crop ne porte PLUS l’opacité du corps d’eau', () => {
  const FRAG = GLOBE_NU.slice(GLOBE_NU.indexOf('const MER_FRAG'), GLOBE_NU.indexOf('const CIRCONFERENCE_MERCATOR'))
  // avant la Tâche R2 : `gl_FragColor = vec4(col, bord * smoothstep(...) * opac);`
  assert.ok(!/gl_FragColor = vec4\(col,[^;]*\*\s*opac\s*\)/.test(FRAG), 'l’alpha dilue encore les reflets')
  // et `opac` sert TOUJOURS — dans le composite, à sa place
  assert.match(FRAG, /composeLameEau\([^)]*opac\)/)
})
