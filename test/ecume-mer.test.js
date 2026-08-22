// ═══════════ TÂCHE P4 — L'ÉCUME, LE RIDEAU D'EAU, ET LEUR BRANCHEMENT ══════
//
// > **Le noteur, 2026-08-22 :** *« l'écume est 7,7 fois trop étendue — et elle
// > est en PLAQUES »* (manque n° 3) · *« la nappe de mer et le dessus du bloc ne
// > sont pas la même surface »* (manque n° 4).
//
// ⚠️ **CE FICHIER GARDE UNE UNICITÉ, PAS UN GOÛT.** L'écart mesuré ne venait
// d'aucune constante de style : il venait de ce que la calotte du globe portait
// une SECONDE ÉCRITURE de la loi d'écume d'`ocean.js`, qui avait divergé sur
// quatre points. Les sections ① à ③ interdisent que ça recommence ; ④ garde le
// FIL (la faiblesse récurrente de ce chantier, sept tâches d'affilée) ; ⑤ garde
// le rideau d'eau ; ⑥ la mesure SIGNÉE du bord.
//
// ⚠️ **CHAQUE CONSTANTE EST CONFRONTÉE À `src/ocean.js` RELU SUR LE DISQUE**, pas
// à un littéral recopié ici : un chiffre recopié dans un test ne rougit pas
// quand la source change sous lui (§0 du plan, défaut endémique des
// dénominateurs).

import test from 'node:test'
import assert from 'node:assert/strict'
import { readFileSync } from 'node:fs'

import {
  lisse01,
  pas0a1,
  POIDS_PROFONDEUR,
  FONDU_RESSAC_FIN,
  FONDU_HOULE_FIN,
  declinRivage,
  fonduRessac,
  fonduHoule,
  ACCALMIE_NEUTRE,
  accalmieDuSocle,
  FREQ_TAVELURE,
  TAVELURE_SEUIL,
  POIDS_RESSAC,
  POIDS_LISERE,
  BLANC_ECUME,
  ecumeMoutons,
  largeurRessac,
  frontsRessac,
  ecumeRessac,
  ecumeLisere,
  ecumeMer,
  GLSL_ECUME,
  // ⚠️ **Tâche P5** : l'état de mer, LU sur le socle et jamais recalculé.
  ETAT_MER_NEUTRE,
  etatMerDuSocle,
  // ⚠️ **Tâche P6** : la LAME D'EAU — quatre réglages de plus, même patron.
  GLSL_LAME_EAU,
  LAME_EAU_NEUTRE,
  lameEauDuSocle,
  detailClapot,
  poidsLagon,
  opaciteEau,
  LAGON_FIN,
  LAGON_EXPO,
  OPACITE_EAU,
  TIRETTE_EAU,
  OPACITE_ECRETAGE,
  NUIT_EAU,
  NUIT_ECUME,
  CLAPOT_NORMALE,
  GLINT_TAVELURE,
} from '../src/monde/ecume-mer.js'
import {
  construireJupeMer,
  GLSL_JUPE_MER,
  RETRAIT_EAU_CROP,
  bordDeMer,
  PORTEE_CROP,
} from '../src/monde/mer-sphere.js'
import { COTE_CROP_UNITES } from '../src/monde/habillage-crop.js'
import { construireSolideCrop } from '../src/monde/parois-crop.js'
import { auditerSolide } from '../src/monde/audit-solide.js'

const SRC_OCEAN = new URL('../src/ocean.js', import.meta.url)
const SRC_GLOBE = new URL('../src/globe.js', import.meta.url)
const SRC_MAIN = new URL('../src/main.js', import.meta.url)
const ocean = () => readFileSync(SRC_OCEAN, 'utf8')
const globe = () => readFileSync(SRC_GLOBE, 'utf8')

/**
 * Le corps d'un `const NOM = /* glsl *\/ ` … `` de `globe.js`.
 * ⚠️ Les COMMENTAIRES sont retirés avant toute recherche de formule : la Tâche
 * K ter a eu une mutation survivante parce qu'une assertion lisait une formule
 * dans un pavé de prose.
 */
function blocGlsl(src, nom) {
  const m = new RegExp(`const ${nom} = /\\* glsl \\*/ \`([\\s\\S]*?)\`\\n`).exec(src)
  assert.ok(m, `bloc ${nom} introuvable`)
  return m[1]
}
const sansCommentaires = (t) => t.replace(/\/\/[^\n]*/g, '').replace(/\/\*[\s\S]*?\*\//g, '')

// ══════════ ① LA LOI PURE, ET CHAQUE CONSTANTE REMONTE À `ocean.js` ════════

test('①a `lisse01` est le `smooth01` d ocean.js, au caractère près', () => {
  const m = /const smooth01 = \(t\) => \{ const x = Math\.min\(1, Math\.max\(0, t\)\); return x \* x \* \(3 - 2 \* x\) \}/.exec(ocean())
  assert.ok(m, 'smooth01 a changé de forme dans ocean.js')
  for (const t of [-1, 0, 0.1, 0.25, 0.5, 0.75, 0.9, 1, 2]) {
    const x = Math.min(1, Math.max(0, t))
    assert.equal(lisse01(t), x * x * (3 - 2 * x))
  }
})

test('①b le POIDS de la profondeur et les deux fins de rampe sortent d ocean.js', () => {
  const s = ocean()
  // `float shoreD = declinRivageMer(uWaterY - f.r, f.g);` — le facteur 2 est
  // passé dans le module ; c'est LUI qui doit encore valoir 2.
  assert.match(s, /float shoreD = declinRivageMer\(uWaterY - f\.r, f\.g\);/)
  assert.equal(POIDS_PROFONDEUR, 2)
  assert.match(s, /float fade = fonduHouleMer\(shoreD\);/)
  assert.match(s, /vFade = fonduRessacMer\(shoreD\);/)
  // les DEUX rampes gardent leurs bornes historiques (0,10 et 0,35)
  assert.equal(FONDU_HOULE_FIN, 0.1)
  assert.equal(FONDU_RESSAC_FIN, 0.35)
  // ⚠️ **ET LE TÉMOIN QUI COMPTE** : `fadeLift` n'est PAS passé au module — il
  // n'est pas de la loi d'écume, et l'y ranger l'aurait rendu muet.
  assert.match(s, /float fadeLift = smoothstep\(0\.0, 0\.55, shoreD\);/)
})

test('①c les poids, le blanc et la tavelure remontent à ocean.js', () => {
  const s = ocean()
  // les trois constantes que le brief accusait — et elles n'ont JAMAIS divergé
  assert.equal(POIDS_RESSAC, 1.8)
  assert.equal(POIDS_LISERE, 1.1)
  assert.equal(BLANC_ECUME, 0.96)
  // ⚠️ **LE BLANCHIMENT A DÉMÉNAGÉ DANS LE MODULE — Tâche P6.** `ocean.js`
  // portait `mix(col, vec3(0.96) * mix(0.14, 1.0, uDayLight), foam)` et le
  // globe portait `mix(col, vec3(0.96), ecume)` : la MÊME loi, amputée de sa
  // nuit d'un côté. Elle vit maintenant une seule fois, dans `GLSL_LAME_EAU`,
  // et les deux fichiers l'APPELLENT.
  assert.match(GLSL_LAME_EAU, /mix\(col, vec3\(0\.96\) \* mix\(0\.14, 1\.0, jour\), ecume\)/)
  assert.match(s, /col = blanchirEcume\(col, foam, uDayLight\);/)
  assert.ok(!/vec3\(0\.96\) \* mix\(0\.14, 1\.0, uDayLight\), foam\)/.test(s),
    'ocean.js ne doit plus porter sa propre ecriture du blanchiment')
  assert.equal(FREQ_TAVELURE, 0.33)
  assert.equal(TAVELURE_SEUIL.bas, 0.32)
  assert.equal(TAVELURE_SEUIL.haut, 0.72)
  // la tavelure d'ocean.js est indexée sur `xz`, EN UNITÉS DE SOCLE
  // ⚠️ **LA FRÉQUENCE EST INTERPOLÉE DEPUIS LE MODULE, PAS ÉCRITE** : la source
  // porte `${FREQ_TAVELURE}`, ce qui est précisément ce qu'on veut garder — une
  // campagne de mutation de P2 a survécu parce que ses motifs cherchaient un
  // chiffre dans un texte qui portait un gabarit.
  assert.match(s, /float patchy = tavelureMer\(vnoise\(xz \* \$\{FREQ_TAVELURE\} \+ vec2\(uTime \* 0\.015, -uTime \* 0\.011\)\)\)/)
  assert.match(s, /vec2 xz = vWorld\.xz;/)
})

test('①d le déclin prend la PROFONDEUR quand elle domine, la distance sinon', () => {
  // ⛔ **C'EST LE TERME QUI MANQUAIT, ET C'EST LE PLUS GROS DES QUATRE.** Sur une
  // île volcanique le fond plonge en quelques centaines de mètres : c'est lui
  // qui tue la bande de ressac, pas la distance au rivage.
  assert.equal(declinRivage(0.5, 0.1), 1) // 2 × 0,5 l'emporte
  assert.equal(declinRivage(0.01, 0.4), 0.4) // la distance l'emporte
  assert.equal(declinRivage(0, 0), 0)
  // et le fondu large VAUT 1 bien avant que la distance n'y arrive seule
  assert.ok(fonduRessac(declinRivage(0.2, 0)) === 1)
  assert.ok(fonduRessac(declinRivage(0, 0.2)) < 1)
})

test('①e la bande de ressac est BORNÉE, et son maximum est là où ocean.js le met', () => {
  let arg = null
  let max = -1
  for (let i = 0; i <= 4000; i++) {
    const f = i / 4000
    const w = largeurRessac(f)
    assert.ok(w >= 0 && w <= 1, `largeur hors [0,1] à ${f}`)
    if (w > max) { max = w; arg = f }
  }
  assert.ok(max > 0.99, `la bande ne monte qu à ${max}`)
  assert.ok(arg >= 0.03 && arg < 0.10, `plateau à ${arg}`)
  assert.equal(largeurRessac(0), 0)
  assert.equal(largeurRessac(1), 0)
})

test('①e bis les fronts de ressac et `pas0a1` sont ceux du GLSL, pas des jumeaux libres', () => {
  // `bands = 0.5 + 0.5 * sin(vFade * 14.0 - uTime * 1.6 + foamNoise * 4.0)`
  for (const [f, t, b] of [[0, 0, 0], [0.5, 1, 0.25], [1, 3.5, 0.9]]) {
    assert.ok(Math.abs(frontsRessac(f, t, b) - (0.5 + 0.5 * Math.sin(f * 14 - t * 1.6 + b * 4))) < 1e-15)
  }
  // ⚠️ **LES FRONTS SONT LA SEULE PART ANIMÉE DE L'ÉCUME** : sans eux la bande
  // de ressac serait un anneau figé. Ils balaient bien [0, 1].
  let bas = 1
  let haut = 0
  for (let t = 0; t < 12; t += 0.01) { const v = frontsRessac(0.05, t, 0.3); bas = Math.min(bas, v); haut = Math.max(haut, v) }
  assert.ok(bas < 0.01 && haut > 0.99, `les fronts ne balaient que [${bas}, ${haut}]`)
  // `pas0a1` est le `smoothstep` du GLSL, bornes comprises
  assert.equal(pas0a1(0.2, 0.8, 0.1), 0)
  assert.equal(pas0a1(0.2, 0.8, 0.9), 1)
  assert.equal(pas0a1(0, 1, 0.5), 0.5)
})

test('①f l écume est bornée, monotone en accalmie, et NULLE à accalmie nulle', () => {
  const a = { foam: 1.9, foamEchelle: 1, crete: 1, bruit1: 0.9, bruit2: 1, tavelure: 1, fade: 0.05, temps: 0 }
  assert.equal(ecumeMer({ ...a, calmeVue: 0, calmeSurface: 0 }), 0)
  // ⚠️ **`calmeVue = 0` ÉTEINT TOUT, `calmeSurface = 0` ÉTEINT LES DEUX TERMES
  // DE CÔTE SEULEMENT** — c'est exactement ce que fait `ocean.js`, et c'est ce
  // qui rend l'un des deux utilisable comme interrupteur de banc.
  assert.equal(ecumeMoutons({ ...a, calmeVue: 0 }), 0)
  assert.ok(ecumeMoutons({ ...a, calmeVue: 1 }) > 0)
  assert.equal(ecumeRessac({ ...a, calmeVue: 1, calmeSurface: 0 }), 0)
  assert.equal(ecumeLisere({ ...a, fade: 0.001, calmeVue: 1, calmeSurface: 0 }), 0)
  let prec = -1
  for (let i = 0; i <= 20; i++) {
    const v = ecumeMer({ ...a, calmeVue: i / 20, calmeSurface: 1 })
    assert.ok(v >= prec - 1e-12, `non monotone à ${i}`)
    assert.ok(v >= 0 && v <= 1)
    prec = v
  }
})

test('①g le facteur perdu du ressac — (0,5 + 0,5 × foamEchelle) — est bien là', () => {
  // ⚠️ **RELEVÉ SUR LA PAGE VIVANTE LE 2026-08-22** : le socle porte
  // `uFoamScale = 1`, `uViewCalm = 0,4039`, `uSurfCalm = 0,08`. Le ressac y est
  // donc multiplié par 1 × 0,4039 × 0,08 = **0,0323**, quand la calotte le
  // multipliait par **1**. Trente et une fois.
  const base = { fade: 0.05, temps: 0, bruit1: 0.9, calmeVue: 1, calmeSurface: 1 }
  const plein = ecumeRessac({ ...base, foamEchelle: 1 })
  const nul = ecumeRessac({ ...base, foamEchelle: 0 })
  assert.ok(Math.abs(plein - 2 * nul) < 1e-12, `le facteur d échelle a disparu : ${plein} / ${nul}`)
  const vivant = ecumeRessac({ ...base, foamEchelle: 1, calmeVue: 0.4039, calmeSurface: 0.08 })
  assert.ok(Math.abs(vivant / plein - 0.4039 * 0.08) < 1e-12)
  assert.ok(Math.abs(plein / vivant - 30.95) < 0.02, `rapport ${plein / vivant}`)
})

// ══════════ ② LE TEXTE GLSL, TRADUIT ET EXÉCUTÉ ════════════════════════════
//
// ⚠️ **EXÉCUTÉ, PAS RELU.** Une assertion qui cherche une CHAÎNE dans le GLSL
// prouve qu'un texte est là, pas qu'il calcule la même chose que le jumeau JS.
// On traduit le texte du module — celui-là même que les deux nuanceurs
// injectent — et on le confronte au jumeau sur une grille dont le dénominateur
// est COMPTÉ PAR LA BOUCLE, pas annoncé par le titre.

function traduire(glsl, nom, params) {
  const corps = new RegExp(`float ${nom}\\(([\\s\\S]*?)\\)\\s*\\{([\\s\\S]*?)\\n\\}`).exec(glsl)
  assert.ok(corps, `fonction ${nom} introuvable dans le GLSL`)
  const js = corps[2]
    .replace(/\bfloat\b/g, 'let')
    .replace(/\bsmoothstep\(/g, 'SS(')
    .replace(/\bclamp\(/g, 'CL(')
    .replace(/\bmix\(/g, 'MIX(')
    .replace(/\bmax\(/g, 'Math.max(')
    .replace(/\bmin\(/g, 'Math.min(')
    .replace(/\bsin\(/g, 'Math.sin(')
    // ⚠️ **Tâche P6** : `pow` et `poidsLagonEau` entrent dans le traducteur —
    // sans eux `opaciteEau` ne se traduit pas, et un test qui ne tourne pas ne
    // garde rien.
    .replace(/\bpow\(/g, 'Math.pow(')
    .replace(/\blargeurRessacMer\(/g, 'largeurRessacMer(')
  const SS = (a, b, t) => { const x = Math.min(1, Math.max(0, (t - a) / (b - a))); return x * x * (3 - 2 * x) }
  const CL = (v, a, b) => Math.min(b, Math.max(a, v))
  const MIX = (a, b, t) => a + (b - a) * t
  const largeurRessacMer = (f) => (1 - SS(0.1, 0.75, f)) * SS(0.002, 0.03, f)
  const poidsLagonEau = (t) => SS(0, LAGON_FIN, t)
  // eslint-disable-next-line no-new-func
  const f = new Function('SS', 'CL', 'MIX', 'largeurRessacMer', 'poidsLagonEau', ...params, js)
  return (...args) => f(SS, CL, MIX, largeurRessacMer, poidsLagonEau, ...args)
}

test('②a le GLSL `declinRivageMer` calcule ce que le jumeau JS calcule', () => {
  const g = traduire(GLSL_ECUME, 'declinRivageMer', ['profondeur', 'distance'])
  let n = 0
  for (let p = 0; p <= 2; p += 0.05) {
    for (let d = 0; d <= 1; d += 0.02) {
      assert.ok(Math.abs(g(p, d) - declinRivage(p, d)) < 1e-12, `${p} ${d}`)
      n++
    }
  }
  assert.ok(n >= 2000, `${n} points seulement`)
})

test('②b les deux fondus GLSL suivent leurs jumeaux', () => {
  const gr = traduire(GLSL_ECUME, 'fonduRessacMer', ['declin'])
  const gh = traduire(GLSL_ECUME, 'fonduHouleMer', ['declin'])
  let n = 0
  for (let d = -0.2; d <= 1.2; d += 0.001) {
    assert.ok(Math.abs(gr(d) - fonduRessac(d)) < 1e-12, `ressac ${d}`)
    assert.ok(Math.abs(gh(d) - fonduHoule(d)) < 1e-12, `houle ${d}`)
    n++
  }
  assert.ok(n > 1000, `${n} points seulement`)
})

test('②c le GLSL `largeurRessacMer` suit son jumeau', () => {
  const g = traduire(GLSL_ECUME, 'largeurRessacMer', ['fade'])
  let n = 0
  for (let f = 0; f <= 1; f += 0.0005) {
    assert.ok(Math.abs(g(f) - largeurRessac(f)) < 1e-12, `${f}`)
    n++
  }
  assert.ok(n > 1900, `${n} points seulement`)
})

test('②d le GLSL `ecumeMer` suit son jumeau, terme par terme', () => {
  const g = traduire(GLSL_ECUME, 'ecumeMer',
    ['crete', 'fade', 'bruit1', 'bruit2', 'tavelure', 'temps', 'foam', 'foamEchelle', 'calmeVue', 'calmeSurface'])
  let n = 0
  let nonNuls = 0
  for (const crete of [0, 0.3, 0.45, 0.6, 1]) {
    for (const fade of [0, 0.002, 0.01, 0.05, 0.2, 0.5, 0.75, 1]) {
      for (const b1 of [0, 0.35, 0.7, 1]) {
        for (const b2 of [0, 0.5, 0.9]) {
          for (const tav of [0, 1]) {
            for (const cv of [0.08, 0.4039, 1]) {
              for (const cs of [0.08, 1]) {
                const a = { crete, fade, bruit1: b1, bruit2: b2, tavelure: tav, temps: 3.5, foam: 1.9, foamEchelle: 1, calmeVue: cv, calmeSurface: cs }
                const attendu = ecumeMer(a)
                const rendu = g(crete, fade, b1, b2, tav, 3.5, 1.9, 1, cv, cs)
                assert.ok(Math.abs(rendu - attendu) < 1e-12, `${JSON.stringify(a)} : ${rendu} contre ${attendu}`)
                if (attendu > 0) nonNuls++
                n++
              }
            }
          }
        }
      }
    }
  }
  // ⚠️ **LE DÉNOMINATEUR EST COMPTÉ, ET LES POINTS NON NULS AUSSI** : une grille
  // qui ne rendrait que des zéros passerait sans rien prouver.
  assert.equal(n, 5 * 8 * 4 * 3 * 2 * 3 * 2)
  assert.ok(nonNuls > n / 4, `seulement ${nonNuls} points non nuls sur ${n}`)
})

test('②e le GLSL du rideau d eau suit la loi, et le givre nul est EXACT', () => {
  const m = /vec4 couleurJupeMer\(([\s\S]*?)\)\s*\{([\s\S]*?)\n\}/.exec(GLSL_JUPE_MER)
  assert.ok(m, 'couleurJupeMer introuvable')
  const corps = m[2]
  // givre = 0 : `mix(col, X, 0)` rend col, et `mix(0.55, 0.94, 0)` rend 0,55 —
  // c'est EXACT en flottant, pas approché. Le crop passe donc 0 sans dette.
  assert.match(corps, /float a = mix\(0\.55, 0\.94, givre\);/)
  assert.match(corps, /a \*= 1\.0 - 0\.15 \* \(1\.0 - givre\) \* grain;/)
  assert.match(corps, /vec3 col = fond \* mix\(1\.05, 0\.45, g\);/)
  assert.match(corps, /col \*= mix\(vec3\(0\.10, 0\.16, 0\.30\), vec3\(1\.0\), jour\);/)
})

// ══════════ ③ L'UNICITÉ DE L'ÉCRITURE ══════════════════════════════════════

test('③a aucune des formules d écume ne reparaît dans ocean.js ni dans globe.js', () => {
  // ⚠️ **COMMENTAIRES RETIRÉS AVANT DE CHERCHER** : une formule citée dans un
  // pavé de prose a déjà fait passer une mutation pour morte (Tâche K ter).
  const cibles = [
    [/uFoam \* uFoamScale \* uViewCalm \* smoothstep/, 'les moutons'],
    [/uMerEcume \* uMerEcumeEchelle \* smoothstep/, 'les moutons du crop'],
    [/smoothstep\(0\.002, 0\.03, v(Fade|FonduRive)\)/, 'la bande de ressac'],
    [/\* 1\.8 \+ \w+ \* 1\.1/, 'la somme pondérée'],
    [/smoothstep\(0\.0, 0\.35, shoreD\)/, 'le fondu large'],
    [/smoothstep\(0\.32, 0\.72, (vnoise|bruitMer)/, 'la tavelure'],
    [/max\(\(uWaterY - f\.r\) \* 2\.0, f\.g\)/, 'le déclin côtier'],
    [/mix\(0\.55, 0\.94, uFrost\)/, 'l alpha du rideau'],
  ]
  for (const src of [sansCommentaires(ocean()), sansCommentaires(globe())]) {
    for (const [re, quoi] of cibles) {
      assert.ok(!re.test(src), `${quoi} est réécrit hors du module partagé`)
    }
  }
})

test('③b les deux fichiers INJECTENT le texte partagé, ils ne le recopient pas', () => {
  const o = ocean()
  const g = globe()
  // ⚠️ **LA LISTE EXACTE N'EST PLUS EXIGÉE, LES NOMS LE SONT — Tâche P5.**
  // Cette assertion cassait à chaque nom ajouté au module sans rien prouver de
  // plus : ce qui compte est qu'il n'y ait qu'UNE importation, et qu'elle porte
  // ce dont chaque fichier se sert.
  const importOcean = o.match(/import \{([^}]*)\} from '\.\/monde\/ecume-mer\.js'/)
  const importGlobe = g.match(/import \{([^}]*)\} from '\.\/monde\/ecume-mer\.js'/)
  assert.ok(importOcean, "ocean.js doit importer monde/ecume-mer.js")
  assert.ok(importGlobe, "globe.js doit importer monde/ecume-mer.js")
  for (const nom of ['GLSL_ECUME', 'GLSL_LAME_EAU', 'FREQ_TAVELURE', 'accalmieDuSocle', 'etatMerDuSocle', 'lameEauDuSocle']) {
    assert.ok(importOcean[1].includes(nom), `ocean.js doit importer ${nom}`)
  }
  for (const nom of ['GLSL_ECUME', 'GLSL_LAME_EAU', 'FREQ_TAVELURE', 'ACCALMIE_NEUTRE', 'ETAT_MER_NEUTRE', 'LAME_EAU_NEUTRE', 'CLAPOT_NORMALE']) {
    assert.ok(importGlobe[1].includes(nom), `globe.js doit importer ${nom}`)
  }
  // ⚠️ **UNE SEULE ÉCRITURE DE LA LAME D'EAU, ET ELLE EST INJECTÉE DES DEUX
  // CÔTÉS — Tâche P6.** Le texte vit dans `GLSL_LAME_EAU` ; `ocean.js` et
  // `globe.js` l'interpolent une fois chacun, dans leur fragment de mer.
  assert.equal((o.match(/\$\{GLSL_LAME_EAU\}/g) || []).length, 1,
    'ocean.js doit injecter GLSL_LAME_EAU une fois')
  assert.equal((g.match(/\$\{GLSL_LAME_EAU\}/g) || []).length, 1,
    'globe.js doit injecter GLSL_LAME_EAU une fois')
  // injecté dans les DEUX nuanceurs de chaque fichier
  // ⚠️ **TROIS, ET LE TROISIÈME EST LE VERTEX DE LA JUPE DU SOCLE** : il portait
  // lui aussi sa propre copie du déclin côtier (`max((uWaterY − f.r) * 2.0, f.g)`
  // et `smoothstep(0.0, 0.10, shoreD)`). ③a l'a trouvée — trois écritures, pas
  // deux. C'est la neuvième constante muette de ce chantier.
  assert.equal((o.match(/\$\{GLSL_ECUME\}/g) || []).length, 3,
    'ocean.js doit injecter dans son vertex, son fragment ET le vertex de sa jupe')
  assert.equal((g.match(/\$\{GLSL_ECUME\}/g) || []).length, 2, 'globe.js doit injecter dans MER_VERT ET MER_FRAG')
  assert.equal((o.match(/\$\{GLSL_JUPE_MER\}/g) || []).length, 1)
  assert.equal((g.match(/\$\{GLSL_JUPE_MER\}/g) || []).length, 1)
  // et les DEUX appellent la même fonction
  assert.match(o, /float foam = ecumeMer\(vCrest, vFade, foamNoise, foamNoise2, patchy, uTime, uFoam, uFoamScale, uViewCalm, uSurfCalm\);/)
  assert.match(g, /ecumeMer\(vCrete, vFonduRive, n1, n2, tavelure, uMerTemps,\s*\n\s*uMerEcume, uMerEcumeEchelle, uMerCalmeVue, uMerCalmeSurf\)/)
})

test('③c le module est PUR : aucune importation, donc chargeable sous node', () => {
  const src = readFileSync(new URL('../src/monde/ecume-mer.js', import.meta.url), 'utf8')
  assert.ok(!/^\s*import\s/m.test(src), 'ecume-mer.js doit rester sans importation')
})

// ══════════ ④ LE BRANCHEMENT — LA FAIBLESSE RÉCURRENTE DU CHANTIER ═════════

test('④a `accalmieDuSocle` LIT les uniformes vivants, et rend le neutre sinon', () => {
  assert.deepEqual(accalmieDuSocle({ uViewCalm: { value: 0.4039 }, uSurfCalm: { value: 0.08 } }),
    { vue: 0.4039, surface: 0.08 })
  // ⚠️ **LES DEUX CÔTÉS DU COUPLE, ET SÉPARÉMENT.** Une campagne de mutation a
  // survécu ici : le cas ne portait un NaN que sur `uViewCalm`, et la faute
  // symétrique sur `uSurfCalm` passait. **Un guet-apens de test qui ne teste
  // qu'une moitié d'un couple est un guet-apens qui ne teste rien.**
  const cas = [
    null, undefined, {},
    { uViewCalm: { value: NaN }, uSurfCalm: { value: 0.08 } },
    { uViewCalm: { value: 0.4 }, uSurfCalm: { value: NaN } },
    { uViewCalm: { value: NaN }, uSurfCalm: { value: NaN } },
    { uViewCalm: { value: Infinity }, uSurfCalm: { value: null } },
    { uViewCalm: {}, uSurfCalm: {} },
  ]
  for (const mauvais of cas) {
    const a = accalmieDuSocle(mauvais)
    assert.ok(Number.isFinite(a.vue), `vue non finie pour ${JSON.stringify(mauvais)}`)
    assert.ok(Number.isFinite(a.surface), `surface non finie pour ${JSON.stringify(mauvais)}`)
  }
  // ⚠️ **LE NEUTRE EST 1, ET C'EST LA CALOTTE D'AVANT P4 AU BIT PRÈS** — la
  // vertu d'instrument de banc que D13 §① demande de garder.
  assert.equal(ACCALMIE_NEUTRE.vue, 1)
  assert.equal(ACCALMIE_NEUTRE.surface, 1)
})

test('④b `ocean.js` expose ses réglages vivants, GIVRE et CIEL compris', () => {
  const s = ocean()
  assert.match(s, /get reglagesMer\(\) \{/)
  // le givre vit sur le matériau de la JUPE, pas sur celui de la surface :
  // le chercher sur `materials[0]` aurait rendu 0 sans un mot.
  assert.match(s, /this\.materials\.find\(\(m\) => m\?\.uniforms\?\.uFrost\)/)
  assert.match(s, /ciel: u\?\.uSky\?\.value \?\? null/)
  assert.ok(!/get accalmie\(\)/.test(s), 'l ancien accesseur doit avoir disparu')
})

test('④c `main.js` pose les réglages à CHAQUE image, juste après `setView`', () => {
  const s = readFileSync(SRC_MAIN, 'utf8')
  const i = s.indexOf('realWater?.setView(')
  const j = s.indexOf('globe?.majReglagesMer(')
  assert.ok(i > 0 && j > i, 'l appel doit suivre setView, seul écrivain des deux accalmies')
  // ⚠️ et il est GARDÉ par le drapeau : sans `terre unique`, rien n'est posé
  assert.match(s.slice(i, j + 200), /if \(terreUniqueBranchee\) \{\s+globe\?\.majReglagesMer\(/)
  // ⚠️ **ET IL PORTE LES RÉGLAGES VIVANTS DES DEUX SOURCES — Tâche P5** : la mer
  // du socle (`reglagesMer`, qui contient l'état de mer) ET les trois couleurs
  // de fond, qui vivent sur `terrain.mapUniforms` et non sur `realWater`.
  const appel = s.slice(j, j + 400)
  assert.match(appel, /\.\.\.realWater\?\.reglagesMer/)
  // ⚠️ **UN PAR UN, JAMAIS LA POIGNÉE** — `test/damier-uniformes.test.js` ③.
  assert.match(appel, /fond: couleursFondDuSocle\(\s+terrain\.mapUniforms\.uOceanShallow\.value,/)
  // ⚠️ **ET IL N'Y EN A QU'UN** : deux sites poseraient deux valeurs d'une même
  // image, et c'est le genre d'écart qu'on met des soirées à lire.
  assert.equal((s.match(/majReglagesMer\(/g) || []).length, 1)
})

test('④d le nuanceur de la calotte LIT les quatre uniformes neufs', () => {
  const frag = sansCommentaires(blocGlsl(globe(), 'MER_FRAG'))
  const vert = sansCommentaires(blocGlsl(globe(), 'MER_VERT'))
  for (const u of ['uMerCalmeVue', 'uMerCalmeSurf', 'uMerGivre', 'uMerUnite']) {
    assert.match(frag, new RegExp(`uniform float ${u};`), `${u} non déclaré`)
    // déclaré ET LU : la Tâche C a payé une fois un uniforme posé et lu par
    // personne, et la Tâche J en a réveillé deux autres.
    const lectures = (frag.match(new RegExp(`\\b${u}\\b`, 'g')) || []).length
    assert.ok(lectures >= 2, `${u} est déclaré mais lu par personne`)
  }
  assert.match(vert, /uniform float uMerUnite;/)
  assert.match(vert, /uniform float uMerBasY;/)
  assert.match(vert, /vProfondeur \/ max\(uMerUnite, 1e-9\)/)
  // la tavelure est indexée en UNITÉS DE SOCLE, plus en espace de spectre
  assert.match(frag, /bruitMer\(vLocal \/ max\(uMerUnite, 1e-9\) \* \$\{FREQ_TAVELURE\}/)
  assert.ok(!/vLocal \* 0\.33 \/ max\(uMerLambda/.test(frag), 'l ancienne indexation est encore là')
})

test('④e le canal G du champ et `uMerUnite` sortent de la MÊME expression', () => {
  const s = globe()
  // ⚠️ **UNE SEULE ÉCRITURE DU FACTEUR** : la profondeur et la distance au
  // rivage doivent vivre dans la MÊME monnaie, et c'est tout le défaut réparé.
  assert.match(s, /const unite = largeurUnites \/ \(COTE_CROP_UNITES \* portee\)/)
  assert.match(s, /Math\.min\(1, dist\[k\] \/ \(15 \* unite\)\)/)
  assert.ok(!/largeurUnites \/ \(56 \* portee\)/.test(s), 'le 56 en dur est revenu')
  assert.match(s, /uMerUnite: \{ value: champ\.unite \}/)
})

// ══════════ ⑤ LE RIDEAU D'EAU ══════════════════════════════════════════════

const REPERE = { cx: 0.6549072265625, cy: 0.5604248046875, demi: 0.0003662109375 }

test('⑤a le ruban est FERMÉ, en retrait, et son bas tient au fond du bloc', () => {
  const j = construireJupeMer({ repere: REPERE, rayon: 100, basY: -0.12, hauteur: 0.001 })
  const n = j.compte.anneau
  assert.equal(j.compte.sommets, 2 * n)
  assert.equal(j.compte.triangles, 2 * n)
  assert.equal(j.indices.length, n * 6)
  // ⚠️ **FERMÉ** : le dernier segment revient au premier. Un ruban ouvert
  // laisserait une fente d'un point sur le périmètre, invisible en test et
  // parfaitement visible à l'écran.
  const derniers = Array.from(j.indices.slice(n * 6 - 6))
  assert.ok(derniers.includes(0) && derniers.includes(n), 'le ruban ne se referme pas')
  // le bas est PLAT, au fond du bloc ; le haut ne l'est pas (la sphère bombe)
  // Float32 : on compare a la precision du tampon, pas au bit du double
  for (let i = 0; i < n; i++) assert.ok(Math.abs(j.positions[(n + i) * 3 + 1] + 0.12) < 1e-7)
  const hauts = new Set()
  for (let i = 0; i < n; i++) hauts.add(j.positions[i * 3 + 1].toFixed(6))
  assert.ok(hauts.size > 1, 'le haut du ruban devrait suivre la courbure')
  // et `aJupe` vaut 0 en haut, 1 en bas — c'est À LA FOIS le drapeau et le `g`
  for (let i = 0; i < n; i++) { assert.equal(j.jupe[i], 0); assert.equal(j.jupe[n + i], 1) }
})

test('⑤b le RETRAIT est celui de `plinth.js`, et il rentre DANS le crop', () => {
  const plein = construireJupeMer({ repere: REPERE, rayon: 100, basY: -0.1, retrait: 0 })
  const rentre = construireJupeMer({ repere: REPERE, rayon: 100, basY: -0.1 })
  let maxPlein = 0
  let maxRentre = 0
  for (let i = 0; i < plein.uv.length; i += 2) {
    maxPlein = Math.max(maxPlein, Math.abs(plein.uv[i]), Math.abs(plein.uv[i + 1]))
    maxRentre = Math.max(maxRentre, Math.abs(rentre.uv[i]), Math.abs(rentre.uv[i + 1]))
  }
  assert.ok(Math.abs(maxPlein - 1) < 1e-6, `sans retrait le ruban doit toucher la frontière : ${maxPlein}`)
  assert.ok(Math.abs(maxRentre - (1 - RETRAIT_EAU_CROP)) < 1e-6, `avec retrait : ${maxRentre}`)
  // 0,22 unité de socle, exactement le chanfrein + la marge d'eau du mode plat
  assert.ok(Math.abs((1 - maxRentre) * (COTE_CROP_UNITES / 2) - 0.22) < 1e-4)
})

// ══════════ ⑤bis LE SENS DE PARCOURS DU RIDEAU — Tâche P7 ══════════════════
//
// ⛔ **LE DÉFAUT QUE CES QUATRE TESTS FERMENT.** La Tâche P4 a bâti le rideau
// avec `(i, n+i, j)` / `(j, n+i, n+j)` en écrivant à côté « le sens de parcours
// suit celui des parois » — c'était **l'exact inverse** du sens des parois, donc
// des faces avant tournées vers l'INTÉRIEUR. Le matériau de la calotte étant en
// `FrontSide` (relevé sur la page vivante : `side = 0`, quand la jupe du socle
// est en `DoubleSide`), le rideau était **éliminé au culling sur chaque flanc
// tourné vers la caméra**, et le fond marin nu passait par-dessus l'arête haute
// de la paroi — le « tablier » du noteur.
//
// ⚠️ **AUCUN TEST NE REGARDAIT LE SENS**, et c'est pour ça que ça a tenu deux
// tâches : ⑤a compte les triangles, ⑤b mesure le retrait, ⑤c les erreurs. Un
// ruban retourné a exactement le même compte, le même retrait et les mêmes
// erreurs.

/** Le solide des parois sur le MÊME anneau — c'est lui, l'étalon de sens. */
function solideCrop(basY = -0.12) {
  return construireSolideCrop({
    repere: REPERE,
    rayon: 100,
    forme: { coin: 0.08, expo: 4.4 },
    echelle: 1,
    hauteur: () => 0,
    profondeur: Math.abs(basY),
  })
}

test('⑤bis-a le rideau pose EXACTEMENT le même tableau d indices que les PAROIS', () => {
  // ⚠️ **L ÉTALON N EST PAS UNE CONVENTION RECOPIÉE, C EST L AUTRE PIÈCE.**
  // `construireSolideCrop` (`parois-crop.js` §④) DÉMONTRE son orientation ligne
  // à ligne, et `test/crop-parois.test.js` l exige par volume signé. Les deux
  // pièces tracent le même anneau (`contourCrop`, même pas, même forme) et
  // rangent leurs sommets pareil (0…n−1 en haut, n…2n−1 en bas) : leurs
  // triangles de mur DOIVENT donc être les mêmes entiers, dans le même ordre.
  const j = construireJupeMer({ repere: REPERE, rayon: 100, basY: -0.12, forme: { coin: 0.08, expo: 4.4 } })
  const s = solideCrop()
  const n = j.compte.anneau
  assert.equal(s.compte.anneau, n, 'les deux anneaux doivent avoir la même longueur, sinon on ne compare rien')
  const mur = Array.from(s.indices.subarray(0, n * 6))
  const rideau = Array.from(j.indices)
  assert.deepEqual(rideau, mur, 'le rideau et les parois ne tournent plus dans le même sens')
})

test('⑤bis-b chaque triangle du rideau regarde DEHORS — la normale, calculée', () => {
  const j = construireJupeMer({ repere: REPERE, rayon: 100, basY: -0.12, forme: { coin: 0.08, expo: 4.4 } })
  const p = j.positions
  const som = (k) => [p[k * 3], p[k * 3 + 1], p[k * 3 + 2]]
  let dedans = 0
  let horizontales = 0
  let minDot = Infinity
  for (let t = 0; t < j.indices.length; t += 3) {
    const A = som(j.indices[t]), B = som(j.indices[t + 1]), C = som(j.indices[t + 2])
    const e1 = [B[0] - A[0], B[1] - A[1], B[2] - A[2]]
    const e2 = [C[0] - A[0], C[1] - A[1], C[2] - A[2]]
    // three.js : face AVANT = parcours anti-horaire vu de la face, donc
    // e1 × e2 pointe vers l observateur de la face avant.
    const N = [
      e1[1] * e2[2] - e1[2] * e2[1],
      e1[2] * e2[0] - e1[0] * e2[2],
      e1[0] * e2[1] - e1[1] * e2[0],
    ]
    const L = Math.hypot(N[0], N[1], N[2])
    assert.ok(L > 0, 'triangle dégénéré dans le rideau')
    // la direction du DEHORS au barycentre : le rayon horizontal depuis l axe
    // du crop (le contour est convexe et contient l origine, donc le radial
    // suffit à trancher le signe).
    const cx = (A[0] + B[0] + C[0]) / 3
    const cz = (A[2] + B[2] + C[2]) / 3
    const r = Math.hypot(cx, cz)
    const dot = (N[0] * cx + N[2] * cz) / (L * r)
    if (dot <= 0) dedans++
    if (Math.abs(N[1] / L) < 1e-6) horizontales++
    if (dot < minDot) minDot = dot
  }
  assert.equal(dedans, 0, `${dedans} triangles du rideau sur ${j.compte.triangles} regardent DEDANS`)
  // ⚠️ **ET LE RUBAN EST VERTICAL** : sa normale n a pas de composante `y`. Sans
  // cette seconde assertion, un ruban couché à plat passerait le signe.
  assert.equal(horizontales, j.compte.triangles, 'la normale du rideau doit être horizontale')
  // ⚠️ **0,7 ET PAS 0,9, ET LA RAISON EST GÉOMÉTRIQUE** : sur les quatre coins
  // de la superellipse, le rayon depuis l axe et la normale sortante divergent —
  // mesuré ici, le pire vaut **0,7321**, c est-à-dire 42,9°, un peu moins que les
  // 45° du coin d un carré. Exiger 0,9 refuserait les coins ; le signe, lui, est
  // exact partout (`dedans === 0`).
  assert.ok(minDot > 0.7, `la normale la plus obliquement sortante fait ${minDot} avec le radial`)
})

test('⑤bis-c MUTATION — le ruban RETOURNÉ tombe sur le volume signé, pas sur la fermeture', () => {
  // ⚠️ **LA DÉMONSTRATION DU §1 D `audit-solide.js`, REJOUÉE SUR LE RIDEAU** :
  // on lui pose ses deux couvercles pour en faire une coque close, et on audite.
  // Ā ne voit PAS un solide retourné ; seul le volume signé l attrape. C est
  // exactement l instrument que `test/crop-parois.test.js` emploie sur les
  // parois — on ne s en écrit pas un second.
  const j = construireJupeMer({ repere: REPERE, rayon: 100, basY: -0.12, forme: { coin: 0.08, expo: 4.4 } })
  const n = j.compte.anneau
  // sommets : le ruban, puis le centre BAS (2n) et le centre HAUT (2n+1)
  const pos = new Float64Array((2 * n + 2) * 3)
  pos.set(j.positions)
  let hautMoyen = 0
  for (let i = 0; i < n; i++) hautMoyen += j.positions[i * 3 + 1]
  hautMoyen /= n
  pos[2 * n * 3 + 1] = j.positions[n * 3 + 1] // le fond, plat
  pos[(2 * n + 1) * 3 + 1] = hautMoyen
  const capot = (indices) => {
    const idx = new Uint32Array(indices.length + n * 6)
    idx.set(indices)
    let w = indices.length
    for (let k = 0; k < n; k++) {
      const q = (k + 1) % n
      idx[w++] = 2 * n; idx[w++] = n + k; idx[w++] = n + q          // le fond
      idx[w++] = 2 * n + 1; idx[w++] = q; idx[w++] = k              // le couvercle
    }
    return idx
  }
  const sain = auditerSolide({ geometrie: pos, indices: capot(j.indices), axeHauteur: 'y' })
  assert.equal(sain.ferme, true, `non fermé : ‖Ā‖/aire = ${sain.fermetureRelative}`)
  assert.equal(sain.oriente, true, `volume signé ${sain.volume} : le rideau est retourné`)
  assert.equal(sain.sain, true, sain.raison)

  // ⚠️ **ON RETOURNE LA COQUE ENTIÈRE, COUVERCLES COMPRIS.** Ne retourner que le
  // ruban ouvrirait la fermeture, et le test tomberait alors sur ‖Ā‖ — c est-à-
  // dire sur autre chose que ce qu il prétend prouver. (Essayé : `ferme` passe à
  // `false`, et la démonstration s effondre.)
  const envers = new Uint32Array(capot(j.indices))
  for (let t = 0; t < envers.length; t += 3) { const x = envers[t + 1]; envers[t + 1] = envers[t + 2]; envers[t + 2] = x }
  const retourne = auditerSolide({ geometrie: pos, indices: envers, axeHauteur: 'y' })
  assert.equal(retourne.ferme, true, 'un ruban retourné reste FERMÉ — c est tout le piège')
  assert.equal(retourne.oriente, false, 'le volume signé ne voit pas le ruban retourné : il ne mesure rien')
})

test('⑤bis-d la SOURCE ne porte plus le sens fautif, et la calotte garde le sien', () => {
  // ⚠️ Garde-fou de SOURCE, DÉCLARÉ COMME TEL : les trois tests ci-dessus
  // prouvent le comportement ; celui-ci empêche seulement le sens fautif de
  // revenir par un copier-coller, et vérifie qu on n a pas retourné LA CALOTTE
  // au passage — elle, elle regarde vers le HAUT, et son sens est justifié dans
  // `construireCalotte`.
  const s = readFileSync(new URL('../src/monde/mer-sphere.js', import.meta.url), 'utf8')
  const corps = s.replace(/\/\/[^\n]*/g, '')
  assert.ok(!/indices\[m\+\+\] = i; indices\[m\+\+\] = n \+ i; indices\[m\+\+\] = j/.test(corps),
    'le sens fautif du rideau est revenu')
  assert.match(corps, /indices\[m\+\+\] = i; indices\[m\+\+\] = j; indices\[m\+\+\] = n \+ i/)
  assert.match(corps, /indices\[m\+\+\] = a; indices\[m\+\+\] = c; indices\[m\+\+\] = b/)
})

test('⑤c un `basY` absent est une ERREUR, pas un zéro silencieux', () => {
  // ⚠️ Le §7 de `parois-crop.js` en toutes lettres : un point inconnu posé à
  // zéro, c'est-à-dire au NIVEAU DE LA MER, creuse une encoche muette. Ici
  // ce serait un rideau de hauteur nulle sur tout le périmètre.
  assert.throws(() => construireJupeMer({ repere: REPERE, rayon: 100 }), /basY/)
  assert.throws(() => construireJupeMer({ repere: REPERE, rayon: 100, basY: NaN }), /basY/)
  assert.throws(() => construireJupeMer({ rayon: 100, basY: 0 }), /repere/)
  assert.throws(() => construireJupeMer({ repere: REPERE, rayon: 0, basY: 0 }), /rayon/)
})

test('⑤d `poserMer` CONCATÈNE le ruban à la calotte — un seul maillage, une seule houle', () => {
  const s = globe()
  assert.match(s, /const rideau = Number\.isFinite\(basY\)\s*\n\s*\? construireJupeMer\(\{/)
  assert.match(s, /geo\.setAttribute\('aJupe', new THREE\.BufferAttribute\(jupes, 1\)\)/)
  // l'index du ruban est DÉCALÉ du nombre de sommets de la calotte : sans ce
  // décalage le ruban replierait la nappe sur elle-même.
  assert.match(s, /indices\[cal\.indices\.length \+ i\] = rideau\.indices\[i\] \+ nCal/)
  // et les parois retiennent le fond du bloc pour lui
  assert.match(s, /this\._baseYCrop = solide\.baseY/)
  // le nuanceur reconnaît le rideau et le peint AVANT le test du bord
  const frag = sansCommentaires(blocGlsl(s, 'MER_FRAG'))
  const iJupe = frag.indexOf('if (vJupe > 0.0)')
  const iBord = frag.indexOf('float bord =')
  assert.ok(iJupe > 0 && iBord > iJupe, 'le rideau doit sortir AVANT le fondu de bord, qui l éteindrait')
  assert.match(frag, /couleurJupeMer\(uMerFond, uSky, clamp\(vJupe, 0\.0, 1\.0\), uMerGivre, 1\.0, grain\)/)
  // et le bas du ruban ne prend PAS la houle : c'est lui qui tient au fond
  const vert = sansCommentaires(blocGlsl(s, 'MER_VERT'))
  assert.match(vert, /bool basDuRideau = aJupe > 0\.5;/)
  assert.match(vert, /if \(basDuRideau\) p\.y = uMerBasY;/)
  assert.match(vert, /if \(!basDuRideau\) \{/)
})

// ══════════ ⑥ LA MESURE SIGNÉE DU BORD ═════════════════════════════════════

test('⑥a le bord de la mer RENTRE, il ne déborde plus', () => {
  const b = bordDeMer(1, PORTEE_CROP)
  assert.ok(b.fin < 0, `à estompage plein la mer doit s éteindre DEDANS : ${b.fin}`)
  assert.ok(Math.abs(b.fin + RETRAIT_EAU_CROP) < 1e-12)
  assert.ok(b.debut < b.fin)
})

test('⑥b `dBord` est SIGNÉ — sans quoi le retrait ne peut pas exister', () => {
  // ⛔ **LA CAUSE RÉELLE DU PORTE-À-FAUX.** `cq` est un `max(…, 0)` : DEDANS il
  // vaut zéro, `pn` vaut zéro, et `dBord` se fige à `−uCropCoin` — c'est-à-dire
  // à **0** puisque `uCropCoin` vaut 0 dans l'application vivante. La mesure ne
  // portait que le DEHORS, et le fondu ne pouvait structurellement pas rentrer.
  const frag = sansCommentaires(blocGlsl(globe(), 'MER_FRAG'))
  assert.match(frag, /vec2 q = abs\(vCrop\) - \(1\.0 - uCropCoin\);/)
  assert.match(frag, /vec2 cq = max\(q, 0\.0\);/)
  assert.match(frag, /float dBord = pn - uCropCoin \+ min\(max\(q\.x, q\.y\), 0\.0\);/)
  // le jumeau JS de la mesure, exécuté : dedans NÉGATIF, dehors INCHANGÉ
  const dBord = (u, v, coin, n) => {
    const q = [Math.abs(u) - (1 - coin), Math.abs(v) - (1 - coin)]
    const cq = [Math.max(q[0], 0), Math.max(q[1], 0)]
    const pn = Math.pow(Math.pow(cq[0], n) + Math.pow(cq[1], n), 1 / n)
    return pn - coin + Math.min(Math.max(q[0], q[1]), 0)
  }
  for (const coin of [0, 0.2]) {
    // dedans : strictement négatif, et c'est la distance à la frontière
    assert.ok(Math.abs(dBord(0.5, 0, coin, 2) + 0.5) < 1e-12, `coin ${coin}`)
    assert.ok(dBord(0, 0, coin, 2) < -0.99)
    // dehors : le terme intérieur vaut zéro, donc c'est l'expression d'avant
    assert.ok(dBord(1.5, 0, coin, 2) > 0)
    // la frontière est bien à zéro
    assert.ok(Math.abs(dBord(1, 0, coin, 2)) < 1e-12)
  }
  // ⚠️ **ET LE TÉMOIN QUI COMPTE** : avec l'ancienne mesure, à `uCropCoin = 0`,
  // tout l'intérieur rendait exactement 0 — donc un `fin` négatif discardait la
  // mer ENTIÈRE. C'est ce qui est arrivé au premier essai, à l'écran.
  const ancien = (u, v, coin, n) => {
    const cq = [Math.max(Math.abs(u) - (1 - coin), 0), Math.max(Math.abs(v) - (1 - coin), 0)]
    return Math.pow(Math.pow(cq[0], n) + Math.pow(cq[1], n), 1 / n) - coin
  }
  assert.equal(ancien(0.5, 0, 0, 2), 0)
  assert.equal(ancien(0, 0, 0, 2), 0)
  assert.ok(bordDeMer(1).fin < ancien(0.5, 0, 0, 2), 'le fondu tomberait entièrement sous la mesure')
})

// ══════════ ⑦ L'ÉTAT DE MER — Tâche P5, la réserve n° 1 de P4 ══════════════
//
// ⛔ **P4 L'AVAIT MESURÉ ET NE L'AVAIT PAS FERMÉ** : *« le socle vit à
// `uChop = 1`, `uWaveH = 2`, `uFoam = 1,9`, `uFoamScale = 1` ; la calotte prend
// les défauts de `poserMer` […] Ce sont deux MERS différentes. »*
// ⚡ Et il y en avait un **sixième**, non nommé : la VITESSE (`uSpeedMul = 0,4`
// contre `uMerVitesse: { value: 1 }` codé en dur — la houle du crop défilait
// **2,5 fois trop vite**).

test('⑦a `etatMerDuSocle` LIT les six uniformes vivants', () => {
  const socle = {
    uWaveH: { value: 2 }, uChop: { value: 1 }, uFoam: { value: 1.9 },
    uFoamScale: { value: 1 }, uGloss: { value: 110 }, uSpeedMul: { value: 0.4 },
  }
  assert.deepEqual(etatMerDuSocle(socle),
    { houle: 2, chop: 1, ecume: 1.9, ecumeEchelle: 1, brillance: 110, vitesse: 0.4 })
})

test('⑦b sans socle à lire, `etatMerDuSocle` rend le NEUTRE — la mer d avant P5', () => {
  assert.deepEqual(etatMerDuSocle(null), ETAT_MER_NEUTRE)
  assert.deepEqual(etatMerDuSocle(undefined), ETAT_MER_NEUTRE)
  assert.deepEqual(etatMerDuSocle({}), ETAT_MER_NEUTRE)
})

test('⑦c un uniforme absent ou NaN rend SA valeur neutre, jamais celle du voisin', () => {
  // ⚠️ **CHAMP PAR CHAMP** : une lecture qui retomberait en bloc sur le neutre
  // dès qu'un seul uniforme manque jetterait cinq valeurs justes ; une qui
  // prendrait le voisin fabriquerait une mer que personne n'a réglée. Les deux
  // fautes passent un `deepEqual` global si on ne teste pas séparément.
  const noms = {
    houle: 'uWaveH', chop: 'uChop', ecume: 'uFoam',
    ecumeEchelle: 'uFoamScale', brillance: 'uGloss', vitesse: 'uSpeedMul',
  }
  for (const [champ, uni] of Object.entries(noms)) {
    const seul = etatMerDuSocle({ [uni]: { value: 0.987654 } })
    assert.equal(seul[champ], 0.987654, `${uni} n atteint pas ${champ}`)
    for (const [autre, v] of Object.entries(ETAT_MER_NEUTRE)) {
      if (autre === champ) continue
      assert.equal(seul[autre], v, `${uni} a débordé sur ${autre}`)
    }
    // ⚠️ **UN NaN NE PASSE PAS** : il éteint la moitié d'un GPU sans un mot.
    assert.equal(etatMerDuSocle({ [uni]: { value: NaN } })[champ], ETAT_MER_NEUTRE[champ])
    assert.equal(etatMerDuSocle({ [uni]: {} })[champ], ETAT_MER_NEUTRE[champ])
  }
})

test('⑦d les deux valeurs dérivées du NEUTRE remontent à `chopLook` d `ocean.js`', () => {
  // ⚠️ **LU SUR LE DISQUE, PAS RECOPIÉ ICI.** `poserMer` transcrivait
  // `chopLook` (`1,9 × c²` et `240 − 130 × c`) ; `ETAT_MER_NEUTRE` en porte
  // l'image à `c = 0,7`, et ce test la re-dérive depuis la SOURCE d'`ocean.js`.
  const src = ocean()
  const m = src.match(/function chopLook\(c\) \{\s*\n?\s*return \{ detail: [^,]+, foam: ([\d.]+) \* c \* c, gloss: ([\d.]+) - ([\d.]+) \* c \}/)
  assert.ok(m, 'chopLook doit rester lisible dans ocean.js')
  const [, foamK, glossA, glossB] = m.map(Number)
  assert.equal(ETAT_MER_NEUTRE.ecume, foamK * ETAT_MER_NEUTRE.chop * ETAT_MER_NEUTRE.chop)
  assert.equal(ETAT_MER_NEUTRE.brillance, glossA - glossB * ETAT_MER_NEUTRE.chop)
  // et le neutre reste bien celui du dépôt d'avant P5 : chop 0,7, écume 0,35
  assert.equal(ETAT_MER_NEUTRE.chop, 0.7)
  assert.equal(ETAT_MER_NEUTRE.houle, 0.5)
  assert.equal(ETAT_MER_NEUTRE.ecumeEchelle, 0.35)
  assert.equal(ETAT_MER_NEUTRE.vitesse, 1)
})

test('⑦e `ocean.js` REMONTE son état de mer par `reglagesMer`, et par lui seul', () => {
  const src = ocean()
  // un seul accesseur, et il appelle la lecture partagée
  assert.match(src, /get reglagesMer\(\)/)
  assert.equal((src.match(/get reglagesMer\(\)/g) || []).length, 1)
  assert.match(src, /etat: etatMerDuSocle\(u\),/)
  // ⚠️ **ET `globe.js` NE REDÉRIVE RIEN** : plus une seule transcription de
  // `chopLook` dans le nuanceur ni dans `poserMer`. C'était deux écritures
  // d'une loi qui vit dans `ocean.js`.
  const g = sansCommentaires(globe())
  assert.ok(!/1\.9 \* chop \* chop/.test(g), 'globe.js ne doit plus transcrire foam')
  assert.ok(!/240 - 130 \* chop/.test(g), 'globe.js ne doit plus transcrire gloss')
})

test('⑦f `majReglagesMer` est le SEUL écrivain des six uniformes d état de mer', () => {
  // ⚠️ **DEUX ÉCRIVAINS POUR UNE GRANDEUR, C EST LA FAUTE QUE D13 §③ NOMME**, et
  // ce chantier l'a payée sur `hNorm`, sur `uMerUnite` et sur le déclin côtier.
  // Chaque uniforme n'est ASSIGNÉ qu'une fois hors de sa déclaration.
  const g = sansCommentaires(globe())
  for (const uni of ['uMerHoule', 'uMerChop', 'uMerEcume', 'uMerEcumeEchelle', 'uMerBrillance', 'uMerVitesse']) {
    const ecritures = (g.match(new RegExp(`u\\.${uni}\\.value = `, 'g')) || []).length
    assert.equal(ecritures, 1, `${uni} doit avoir UN seul écrivain, pas ${ecritures}`)
  }
})

// ══════════ ⑧ LA LAME D'EAU — Tâche P6, la réserve n° 2 de P5 ══════════════
//
// ⛔ **QUATRE RÉGLAGES QUI N'AVAIENT AUCUN PARAMÈTRE POUR ARRIVER.** P5 avait
// mesuré le symptôme — *« la concentration de luminance vaut 80,97 % côté crop
// contre 30,33 % au socle […] presque tout l'écart vit dans la NAPPE »* — et
// écrit qu'elle ne l'attribuait pas. Relevé le 2026-08-22 au même instant dans
// la même page : `uTransp = 0,57`, `uSunFx = 0,72`, `uDetail = 0,75`,
// `uDayLight = 1`. **Le nuanceur de la calotte n'en portait pas un seul.**
//
// ⚠️ **ET LE NEUTRE N'EST PAS « LA CALOTTE D'AVANT », PARCE QU'IL NE PEUT PAS
// L'ÊTRE** : le nuanceur d'avant portait `mix(0,45 ; 0,95)` SANS le facteur de
// tirette (donc `transparence ≈ 0,1685`) ET le glacis de lagon à plein régime
// (donc `transparence ≥ 0,35`). ⑧d le démontre au lieu de l'affirmer.

test('⑧a `lameEauDuSocle` LIT les quatre uniformes vivants', () => {
  assert.deepEqual(lameEauDuSocle({
    uTransp: { value: 0.57 }, uSunFx: { value: 0.72 },
    uDayLight: { value: 0.31 }, uDetail: { value: 0.75 },
  }), { transparence: 0.57, soleilFx: 0.72, jour: 0.31, detail: 0.75 })
})

test('⑧b sans socle à lire, `lameEauDuSocle` rend le NEUTRE d ocean.js', () => {
  for (const rien of [null, undefined, {}]) {
    assert.deepEqual(lameEauDuSocle(rien), LAME_EAU_NEUTRE)
  }
  // ⚠️ **LES QUATRE NEUTRES REMONTENT À `ocean.js` RELU SUR LE DISQUE**, pas à
  // des littéraux recopiés ici : c'est la discipline du §0 du plan.
  const s = ocean()
  assert.match(s, /uTransp: \{ value: params\.waterTransparency \?\? 0\.4 \}/)
  assert.match(s, /uSunFx: \{ value: params\.waterSunFx \?\? 1 \}/)
  assert.match(s, /uDayLight: \{ value: 1 \}/)
  assert.equal(LAME_EAU_NEUTRE.transparence, 0.4)
  assert.equal(LAME_EAU_NEUTRE.soleilFx, 1)
  assert.equal(LAME_EAU_NEUTRE.jour, 1)
  // le detail est `chopLook(seaChop ?? 0.7).detail`, re-dérivé depuis la SOURCE
  const m = /function chopLook\(c\) \{\s*\n?\s*return \{ detail: ([\d.]+) \+ ([\d.]+) \* c,/.exec(s)
  assert.ok(m, 'chopLook doit rester lisible dans ocean.js')
  assert.equal(LAME_EAU_NEUTRE.detail, Number(m[1]) + Number(m[2]) * 0.7)
  assert.equal(detailClapot(0.7), LAME_EAU_NEUTRE.detail)
  assert.match(s, /uDetail: \{ value: look\.detail \}/)
})

test('⑧c un uniforme absent ou NaN rend SA valeur neutre, jamais celle du voisin', () => {
  // même piège que ⑦c : une lecture qui retomberait EN BLOC sur le neutre dès
  // qu'un seul uniforme manque jetterait trois valeurs justes.
  const noms = { transparence: 'uTransp', soleilFx: 'uSunFx', jour: 'uDayLight', detail: 'uDetail' }
  for (const [champ, uni] of Object.entries(noms)) {
    const seul = lameEauDuSocle({ [uni]: { value: 0.123456 } })
    assert.equal(seul[champ], 0.123456, `${uni} n atteint pas ${champ}`)
    for (const [autre, v] of Object.entries(LAME_EAU_NEUTRE)) {
      if (autre === champ) continue
      assert.equal(seul[autre], v, `${uni} a débordé sur ${autre}`)
    }
    assert.equal(lameEauDuSocle({ [uni]: { value: NaN } })[champ], LAME_EAU_NEUTRE[champ])
    assert.equal(lameEauDuSocle({ [uni]: {} })[champ], LAME_EAU_NEUTRE[champ])
  }
})

test('⑧d AUCUNE transparence ne reproduit le nuanceur d avant — la loi était TRONQUÉE', () => {
  // ⛔ **CE TEST EST LA JUSTIFICATION DU NEUTRE, ET IL EST EXÉCUTÉ.** Le
  // nuanceur d'avant P6 portait DEUX choses incompatibles :
  //   · une opacité `mix(0.45, 0.95, pow(d, 0.55))` SANS facteur de tirette,
  //     ce qui exige `mix(1.15, 0.26, t) = 1`, donc `t = 0,15 / 0,89` ;
  //   · un corps `mix(peu, fond, pow(d, 0.7))` SANS glacis, c'est-à-dire
  //     `poidsLagon(t) = 1`, donc `t >= 0,35`.
  const tOpacite = (TIRETTE_EAU.opaque - 1) / (TIRETTE_EAU.opaque - TIRETTE_EAU.clair)
  assert.ok(tOpacite < LAGON_FIN, `${tOpacite} devrait etre sous le seuil de lagon ${LAGON_FIN}`)
  assert.ok(poidsLagon(tOpacite) < 1, 'les deux exigences se contredisent')
  // et à la transparence vivante du socle, la lame est bien MOINS opaque
  const brute = OPACITE_EAU.bas + (OPACITE_EAU.haut - OPACITE_EAU.bas) * Math.pow(0.5, OPACITE_EAU.expo)
  const vivante = opaciteEau(0.5, 0.57, 0)
  assert.ok(vivante < brute, `${vivante} devrait etre sous ${brute}`)
  // le rapport mesuré : mix(1.15, 0.26, 0.57) = 0,6427
  const facteur = TIRETTE_EAU.opaque + (TIRETTE_EAU.clair - TIRETTE_EAU.opaque) * 0.57
  assert.ok(Math.abs(facteur - 0.6427) < 1e-4, `${facteur}`)
  assert.ok(Math.abs(vivante / brute - facteur) < 1e-12, 'a lagon plein le rapport EST le facteur de tirette')
})

test('⑧e `opaciteEau` est bornée, monotone en profondeur, et le lagon ferme la marche', () => {
  let n = 0
  for (let t = 0; t <= 1.0001; t += 0.01) {
    let precedent = -1
    for (let d = 0; d <= 1.0001; d += 0.01) {
      const w = opaciteEau(d, t, 0)
      assert.ok(w >= 0 && w <= 1, `w=${w} hors [0,1] a t=${t} d=${d}`)
      assert.ok(w >= precedent - 1e-12, `non monotone a t=${t} d=${d}`)
      precedent = w
      n++
    }
  }
  assert.ok(n > 10000, `${n} points seulement`)
  // transparence NULLE : peinture pleine, l'eau est opaque partout
  for (const d of [0, 0.3, 0.7, 1]) assert.equal(opaciteEau(d, 0, 0), 1)
  // le plancher de Fresnel remonte l'opacité, et il tombe APRÈS l'écrêtage
  assert.ok(opaciteEau(0, 1, 1) > opaciteEau(0, 1, 0))
})

test('⑧f le GLSL de la lame d eau suit ses jumeaux JS, point par point', () => {
  const gl = traduire(GLSL_LAME_EAU, 'poidsLagonEau', ['transparence'])
  const go = traduire(GLSL_LAME_EAU, 'opaciteEau', ['dLagon', 'transparence', 'fresnel'])
  let n = 0
  for (let t = 0; t <= 1.0001; t += 0.02) {
    assert.ok(Math.abs(gl(t) - poidsLagon(t)) < 1e-12, `lagon ${t}`)
    for (let d = 0; d <= 1.0001; d += 0.05) {
      for (const f of [0, 0.25, 0.5]) {
        assert.ok(Math.abs(go(d, t, f) - opaciteEau(d, t, f)) < 1e-12, `opacite ${d} ${t} ${f}`)
        n++
      }
    }
  }
  assert.ok(n > 3000, `${n} points seulement`)
})

test('⑧g les lois de `GLSL_LAME_EAU` sont INTERPOLÉES, jamais réécrites', () => {
  // ⚠️ **LES MOTIFS VISENT LES NOMS, PAS LES CHIFFRES** — la leçon d'une
  // mutation survivante de P2 : ses motifs cherchaient `0.35` dans un texte qui
  // portait `${PART_OMBRAGE.toFixed(2)}`.
  const src = readFileSync(new URL('../src/monde/ecume-mer.js', import.meta.url), 'utf8')
  for (const nom of ['LAGON_FIN', 'LAGON_EXPO', 'OPACITE_EAU', 'TIRETTE_EAU', 'OPACITE_ECRETAGE', 'NUIT_EAU', 'NUIT_ECUME', 'CLAPOT_NORMALE', 'GLINT_TAVELURE', 'BLANC_ECUME']) {
    assert.ok(new RegExp(`\\$\\{${nom}`).test(src), `${nom} doit être interpolé dans le GLSL`)
  }
  // et les valeurs elles-mêmes sont celles d'ocean.js
  assert.equal(LAGON_FIN, 0.35)
  assert.equal(LAGON_EXPO, 0.7)
  assert.deepEqual(NUIT_EAU, [0.1, 0.16, 0.3])
  assert.equal(NUIT_ECUME, 0.14)
  assert.equal(CLAPOT_NORMALE.gain, 0.6)
  assert.equal(CLAPOT_NORMALE.haut, 0.9)
  assert.equal(CLAPOT_NORMALE.freq, 6)
  assert.equal(GLINT_TAVELURE.base, 0.35)
  assert.equal(GLINT_TAVELURE.gain, 0.85)
  assert.equal(OPACITE_ECRETAGE.bas, 0.05)
  assert.equal(OPACITE_ECRETAGE.haut, 0.97)
  // ⚠️ **ET `ocean.js` NE PORTE PLUS AUCUNE DES CINQ FORMULES.** Une seconde
  // écriture, même identique aujourd'hui, diverge demain — c'est le motif que ce
  // fichier existe pour fermer.
  const o = sansCommentaires(ocean())
  assert.ok(!/mix\(0\.45, 0\.95, pow\(dRt, 0\.55\)\)/.test(o), 'wOp est encore ecrit dans ocean.js')
  assert.ok(!/mix\(1\.15, 0\.26, uTransp\)/.test(o), 'le facteur de tirette est encore dans ocean.js')
  assert.ok(!/smoothstep\(0\.0, 0\.35, uTransp\)/.test(o), 'le poids de lagon est encore dans ocean.js')
  assert.ok(!/uDetail \* 0\.6 \* uViewCalm/.test(o), 'le clapot de normale est encore dans ocean.js')
  assert.ok(!/0\.35 \+ 0\.85 \* patchy/.test(o), 'le glint de tavelure est encore dans ocean.js')
  // …et `ocean.js` les APPELLE toutes
  const brut = ocean()
  for (const appel of [
    /float lagoonW = poidsLagonEau\(uTransp\);/,
    /vec3 body = corpsEau\(uShallowT, uDeep, dRt, lagoonW, uDayLight\);/,
    /float wOp = opaciteEau\(dRt, uTransp, fres\);/,
    /vec3 N = clapotNormale\(vNorm, uDetail, uViewCalm, n1, n2\);/,
    /col \+= uSunColor \* spec \* uSunFx \* glintTavelureMer\(patchy\);/,
    /col = blanchirEcume\(col, foam, uDayLight\);/,
  ]) assert.match(brut, appel)
})

test('⑧h la calotte du globe APPELLE les mêmes lois, avec les uniformes branchés', () => {
  const g = sansCommentaires(globe())
  // ⛔ **LES DEUX FORMULES TRONQUÉES ONT DISPARU DU NUANCEUR DE LA CALOTTE.**
  assert.ok(!/mix\(uMerPeu, uMerFond, pow\(dLagon, 0\.7\)\)/.test(g), 'le corps tronque est encore la')
  assert.ok(!/mix\(0\.45, 0\.95, pow\(dLagon, 0\.55\)\)/.test(g), 'l opacite tronquee est encore la')
  for (const appel of [
    /vec3 col = corpsEau\(uMerPeu, uMerFond, dLagon, poidsLagonEau\(uMerTransp\), uMerJour\);/,
    /float opac = opaciteEau\(dLagon, uMerTransp, fres\);/,
    /vec3 N = clapotNormale\(normalize\(vNormMer\), uMerDetail, uMerCalmeVue, r1, r2\);/,
    /col = blanchirEcume\(col, ecume, uMerJour\);/,
    /\* uMerSoleilFx \* vRichesse;/,
  ]) assert.match(g, appel)
  // ⚠️ **LE CLAPOT EST INDEXÉ EN UNITÉS DE SOCLE**, converti par `uMerUnite` —
  // la MÊME monnaie que la tavelure depuis P4, pas une seconde.
  // ⚠️ **ET LE MOTIF VISE LE NOM, PAS LE CHIFFRE** : la source porte le gabarit
  // `${CLAPOT_NORMALE.freq…}`, pas `6.0`. Une assertion sur le chiffre ne
  // rougirait pas si quelqu'un remplaçait l'interpolation par un littéral,
  // c'est-à-dire par la seconde écriture qu'on interdit.
  assert.match(g, /vec2 rp = vLocal \/ max\(uMerUnite, 1e-9\) \* \$\{CLAPOT_NORMALE\.freq\.toFixed\(1\)\};/)
  // ⛔ **ET LE SOLEIL DE LA MER N EST PLUS CELUI DE LA PLANÈTE.** Relevé le
  // 2026-08-22 : `uSunDir` valait (0,2305 -0,3687 0,9005), SOUS l'horizon,
  // parce que `main.js` le repose par image sur la CAMÉRA.
  assert.match(g, /vec3 L = normalize\(uEclairageOn > 0\.5 \? uSoleilDir : uSunDir\);/)
})

test('⑧i les quatre uniformes de lame ont UN SEUL écrivain — `majReglagesMer`', () => {
  const g = sansCommentaires(globe())
  for (const uni of ['uMerTransp', 'uMerSoleilFx', 'uMerJour', 'uMerDetail']) {
    const n = (g.match(new RegExp(`u\\.${uni}\\.value = `, 'g')) || []).length
    assert.equal(n, 1, `${uni} doit avoir UN seul écrivain, pas ${n}`)
  }
  // …et les deux couleurs de la lame aussi
  for (const uni of ['uMerPeu', 'uMerFond']) {
    const n = (g.match(new RegExp(`u\\.${uni}\\.value\\.(copy|set)\\(`, 'g')) || []).length
    assert.equal(n, 1, `${uni} doit avoir UN seul écrivain, pas ${n}`)
  }
})

test('⑧j `ocean.js` REMONTE la lame, les couleurs, le soleil et le spectre', () => {
  const src = ocean()
  assert.match(src, /eau: lameEauDuSocle\(u\),/)
  assert.match(src, /couleurs: couleursEauDuSocle\(u\?\.uShallowT\?\.value \?\? null, u\?\.uDeep\?\.value \?\? null\),/)
  assert.match(src, /soleilCouleur: u\?\.uSunColor\?\.value \?\? null,/)
  // ⚠️ **LE SPECTRE PAR RÉFÉRENCE** — c'est ce que `_applySea` fait déjà pour
  // les matériaux du socle ; la calotte entre dans la même liste de lecteurs.
  assert.match(src, /spectre: u \? \{ a: u\.uWaveA\?\.value \?\? null, b: u\.uWaveB\?\.value \?\? null \} : null,/)
  assert.match(src, /mat\.uniforms\.uWaveA\.value = u\.a/)
  // ⛔ **ET LA COULEUR DU SOLEIL EST BIEN CELLE QU `update` RECOPIE PAR IMAGE**,
  // pas la lampe lue une seconde fois : une grandeur, un écrivain.
  assert.match(src, /if \(sun && mat\.uniforms\.uSunColor\) mat\.uniforms\.uSunColor\.value\.copy\(sun\.color\)/)
})

test('⑧k les trois lois `vec3` de la lame gardent leur STRUCTURE, terme par terme', () => {
  // ⛔ **SURVIVANTES N° 30 ET 38 DU PREMIER TOUR.** `corpsEau`, `clapotNormale`
  // et `blanchirEcume` rendent des `vec3` : le traducteur de ⑧f ne prend que
  // les `float`, et rien ne les gardait. ⚠️ **ASSERTIONS DE SOURCE, DÉCLARÉES
  // TELLES** — elles gardent la STRUCTURE de la loi ; les VALEURS, elles, sont
  // gardées par ⑧g, qui les confronte au module.
  //
  // ⚠️ **ET LES BORNES SONT INTERPOLÉES DEPUIS LES CONSTANTES DU MODULE, PAS
  // RECOPIÉES** : `GLSL_LAME_EAU` est le texte RÉSOLU (le gabarit est évalué au
  // chargement), donc un motif qui porterait `0.7` en dur cesserait de suivre
  // `LAGON_EXPO`. C'est la leçon de la mutation survivante de P2.
  const e = (s) => String(s).replace(/[.*+?^${}()|[\]\\]/g, '\\$&')
  const corps = new RegExp(
    'vec3 corpsEau\\(vec3 peu, vec3 fond, float dLagon, float lagon, float jour\\) \\{\\s*\\n'
    + '\\s*vec3 c = mix\\(fond, mix\\(peu, fond, pow\\(dLagon, ' + e(LAGON_EXPO.toFixed(1)) + '\\)\\), lagon\\);\\s*\\n'
    + '\\s*return c \\* mix\\(vec3\\(' + e(NUIT_EAU[0].toFixed(2)) + ', ' + e(NUIT_EAU[1].toFixed(2)) + ', '
    + e(NUIT_EAU[2].toFixed(2)) + '\\), vec3\\(1\\.0\\), jour\\);')
  assert.match(GLSL_LAME_EAU, corps, 'le glacis de lagon doit encadrer le dégradé, et la nuit multiplier le tout')
  // ⚠️ **LE TÉMOIN QUI DIT QUE CE MOTIF DISTINGUE QUELQUE CHOSE** : privé du
  // glacis — c'est mot pour mot ce que faisait la survivante n° 30 — il doit
  // rougir. Sans ce témoin, un motif trop lâche « passerait » sans rien garder.
  assert.ok(!corps.test(GLSL_LAME_EAU.replace('mix(fond, mix(peu, fond,', 'mix(peu, fond,')),
    'le motif du corps doit rougir si le glacis disparaît')

  // le clapot porte l'accalmie de vue ET le réglage de clapot — survivante n° 38
  const clapot = new RegExp(
    'vec3 clapotNormale\\(vec3 normale, float detail, float calmeVue, float b1, float b2\\) \\{\\s*\\n'
    + '\\s*return normalize\\(normale \\+ detail \\* ' + e(CLAPOT_NORMALE.gain.toFixed(1))
    + ' \\* calmeVue \\* vec3\\(b1 - 0\\.5, ' + e(CLAPOT_NORMALE.haut.toFixed(1)) + ', b2 - 0\\.5\\)\\);')
  assert.match(GLSL_LAME_EAU, clapot, 'le clapot doit porter le réglage ET l accalmie de vue')
  assert.ok(!clapot.test(GLSL_LAME_EAU.replace(' * calmeVue * vec3(b1', ' * vec3(b1')),
    'le motif du clapot doit rougir si l accalmie disparaît')

  // l'écume se blanchit VERS un blanc qui tombe la nuit
  const blanc = new RegExp(
    'return mix\\(col, vec3\\(' + e(BLANC_ECUME.toFixed(2)) + '\\) \\* mix\\('
    + e(NUIT_ECUME.toFixed(2)) + ', 1\\.0, jour\\), ecume\\);')
  assert.match(GLSL_LAME_EAU, blanc)
  assert.ok(!blanc.test(GLSL_LAME_EAU.replace(' * mix(' + NUIT_ECUME.toFixed(2) + ', 1.0, jour)', '')),
    'le motif du blanchiment doit rougir si la nuit disparaît')
})

test('⑧l l ORDRE de `opaciteEau` est celui d ocean.js, et le clamp N EST PAS mort', () => {
  // ⚠️ **UNE MUTATION DE MON PREMIER TOUR ÉTAIT NEUTRE, ET JE LE DIS PLUTÔT QUE
  // DE LA COMPTER.** « le plancher de Fresnel tombe AVANT l'écrêtage » —
  // `max(clamp(x), y)` contre `clamp(max(x, y))` — est mathématiquement
  // IDENTIQUE tant que `y` reste entre les deux bornes. Or `fresnel` est écrêté
  // à 0,5 dans les deux nuanceurs, donc `y = fresnel × 0,5 ≤ 0,25`, et
  // 0,05 ≤ 0,25 ≤ 0,97. **Ce n'était pas un trou de test : la permutation ne
  // change rien.** Ce test le DÉMONTRE au lieu de l'affirmer.
  let n = 0
  for (let d = 0; d <= 1.0001; d += 0.01) {
    for (let t = 0; t <= 1.0001; t += 0.01) {
      for (const f of [0, 0.1, 0.25, 0.5]) {
        const lagon = poidsLagon(t)
        const brut = OPACITE_EAU.bas + (OPACITE_EAU.haut - OPACITE_EAU.bas) * Math.pow(d, OPACITE_EAU.expo)
        const x = brut * (TIRETTE_EAU.opaque + (TIRETTE_EAU.clair - TIRETTE_EAU.opaque) * t)
        const y = f * 0.5
        const ordreA = Math.max(Math.min(OPACITE_ECRETAGE.haut, Math.max(OPACITE_ECRETAGE.bas, x)), y)
        const ordreB = Math.min(OPACITE_ECRETAGE.haut, Math.max(OPACITE_ECRETAGE.bas, Math.max(x, y)))
        assert.equal(ordreA, ordreB, `les deux ordres divergent a d=${d} t=${t} f=${f}`)
        assert.ok(Math.abs(opaciteEau(d, t, f) - (1 + (ordreA - 1) * lagon)) < 1e-15)
        n++
      }
    }
  }
  assert.ok(n > 40000, `${n} points seulement`)
  // ⛔ **ET LE CLAMP LUI-MÊME EST INERTE DANS LA PLAGE VISIBLE, C'EST MESURÉ.**
  // Là où le glacis est plein (`transparence >= 0,35`), le facteur de tirette
  // vaut au plus 0,8385 et l'opacité brute au plus 0,95 : le produit plafonne à
  // 0,7966, sous les 0,97 de l'écrêtage haut ; et au plus bas 0,45 × 0,26 =
  // 0,117, au-dessus des 0,05 de l'écrêtage bas. **Il ne mord que là où
  // `mix(1, w, lagon)` l'efface.** Dit ici plutôt que découvert par une
  // survivante de plus.
  let mord = 0
  for (let d = 0; d <= 1.0001; d += 0.01) {
    for (let t = LAGON_FIN; t <= 1.0001; t += 0.01) {
      const brut = OPACITE_EAU.bas + (OPACITE_EAU.haut - OPACITE_EAU.bas) * Math.pow(d, OPACITE_EAU.expo)
      const x = brut * (TIRETTE_EAU.opaque + (TIRETTE_EAU.clair - TIRETTE_EAU.opaque) * t)
      if (x > OPACITE_ECRETAGE.haut || x < OPACITE_ECRETAGE.bas) mord++
    }
  }
  assert.equal(mord, 0, 'l ecretage ne doit jamais mordre la ou le glacis est plein')
})
