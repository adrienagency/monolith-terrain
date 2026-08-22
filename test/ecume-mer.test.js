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
} from '../src/monde/ecume-mer.js'
import {
  construireJupeMer,
  GLSL_JUPE_MER,
  RETRAIT_EAU_CROP,
  bordDeMer,
  PORTEE_CROP,
} from '../src/monde/mer-sphere.js'
import { COTE_CROP_UNITES } from '../src/monde/habillage-crop.js'

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
  assert.match(s, /col = mix\(col, vec3\(0\.96\) \* mix\(0\.14, 1\.0, uDayLight\), foam\)/)
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
    .replace(/\blargeurRessacMer\(/g, 'largeurRessacMer(')
  const SS = (a, b, t) => { const x = Math.min(1, Math.max(0, (t - a) / (b - a))); return x * x * (3 - 2 * x) }
  const CL = (v, a, b) => Math.min(b, Math.max(a, v))
  const MIX = (a, b, t) => a + (b - a) * t
  const largeurRessacMer = (f) => (1 - SS(0.1, 0.75, f)) * SS(0.002, 0.03, f)
  // eslint-disable-next-line no-new-func
  const f = new Function('SS', 'CL', 'MIX', 'largeurRessacMer', ...params, js)
  return (...args) => f(SS, CL, MIX, largeurRessacMer, ...args)
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
  assert.match(o, /import \{ GLSL_ECUME, FREQ_TAVELURE, accalmieDuSocle \} from '\.\/monde\/ecume-mer\.js'/)
  assert.match(g, /import \{ GLSL_ECUME, FREQ_TAVELURE, BLANC_ECUME, ACCALMIE_NEUTRE \} from '\.\/monde\/ecume-mer\.js'/)
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
  for (const mauvais of [null, undefined, {}, { uViewCalm: { value: NaN }, uSurfCalm: { value: 0.08 } }]) {
    const a = accalmieDuSocle(mauvais)
    assert.ok(Number.isFinite(a.vue) && Number.isFinite(a.surface), `${String(mauvais)}`)
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
  const j = s.indexOf('globe?.majReglagesMer(realWater?.reglagesMer)')
  assert.ok(i > 0 && j > i, 'l appel doit suivre setView, seul écrivain des deux accalmies')
  // ⚠️ et il est GARDÉ par le drapeau : sans `terre unique`, rien n'est posé
  assert.match(s.slice(i, j + 80), /if \(terreUniqueBranchee\) globe\?\.majReglagesMer/)
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
