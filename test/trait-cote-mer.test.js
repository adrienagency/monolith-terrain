// ═══════════ TÂCHE R5 — LE TRAIT MER/TERRE DE LA NAPPE DU CROP ═════════════
//
// > **Adrien, 2026-08-23 :** *« Il y a une grosse régression sur la qualité du
// > trait de séparation mer / terre. »*
//
// ⚠️ **CE FICHIER GARDE UNE FRÉQUENCE D'ÉCHANTILLONNAGE, PAS UN GOÛT — ET
// C'EST LA SEULE CHOSE QUE J'AI TROUVÉE QUI DIFFÈRE STRUCTURELLEMENT DU
// SOCLE.** `src/ocean.js` décide de la terre et de la mer **dans son nuanceur
// de FRAGMENT** : il y lit `uField` (`vec2 f = texture2D(uField, uvF).rg`) et en
// tire `depth` puis `shoreAA`. `src/globe.js` lisait le même champ **dans son
// nuanceur de SOMMETS** et n'en passait au fragment que trois varyings
// (`vProfondeur`, `vProfondeurEau`, `vFonduRive`). La ligne d'eau du crop était
// donc le zéro d'une fonction affine par triangle, sur une calotte de 192
// segments de côté.
//
// ⚡ **CE QUE ÇA VAUT, MESURÉ** (La Réunion −21,05 / 55,25 z12, cadrage côte,
// bloc apparié à −0,03 %, boucle gelée, houle et écume à zéro des deux côtés,
// plan A-B-A identique au chiffre près — `.banc/R5/`) : la maille de la nappe
// vaut **6,475 px** à l'écran, le texel du champ **3,238 px**, celui du socle
// **1,08 px**. **La maille bornait à deux fois le texel qu'elle échantillonne**,
// et la bascule déplace **856 pixels** de mer sur 75 988.
//
// ⛔ **ET C'EST CE QUI REND LA « ROUTE A » INOPÉRANTE, MESURÉ AUSSI** : à
// lecture par sommet, tripler la résolution du champ (385² → 1153²) déplace
// **19 pixels sur 75 988**. Le maillage ne prend que 193 échantillons quoi qu'il
// arrive. Ce test est ce qui empêche de reperdre la précondition.
//
// ⚠️ **CHAQUE CHOSE EST CONFRONTÉE AUX DEUX SOURCES RELUES SUR LE DISQUE**, pas
// à un littéral recopié ici : un chiffre recopié dans un test ne rougit pas
// quand la source change sous lui. `src/globe.js` n'est pas importable sous node
// pour son GLSL (il tire three), donc on lit le TEXTE — c'est ce que font déjà
// `test/crop-habillage.test.js` et `test/ecume-mer.test.js`.

import test from 'node:test'
import assert from 'node:assert/strict'
import { readFileSync } from 'node:fs'
// ⚠️ **LES JUMELLES JS DES TROIS FONCTIONS DU GLSL — tour de correction, ⑥.**
// `src/monde/ecume-mer.js` est PUR (aucune importation — `③c` de
// `test/ecume-mer.test.js` l'exige), donc chargeable sous node. Elles servent à
// EXÉCUTER le bloc par fragment, pas à le décrire.
import { profondeurEau, declinRivage, fonduRessac } from '../src/monde/ecume-mer.js'

const globe = readFileSync(new URL('../src/globe.js', import.meta.url), 'utf8')
const ocean = readFileSync(new URL('../src/ocean.js', import.meta.url), 'utf8')

/** Extrait un template literal `const NOM = /* glsl *\/ ` … ` ` de la source. */
function morceau(src, nom) {
  const i = src.indexOf(`const ${nom} = /* glsl */ \``)
  assert.ok(i >= 0, `${nom} introuvable`)
  const debut = src.indexOf('`', i) + 1
  const fin = src.indexOf('\n`', debut)
  assert.ok(fin > debut, `${nom} : fin de template introuvable`)
  return src.slice(debut, fin)
}

const MER_VERT = morceau(globe, 'MER_VERT')
const MER_FRAG = morceau(globe, 'MER_FRAG')

// ── ① LA RÈGLE DU SOCLE, RELUE CHEZ LUI ────────────────────────────────────
//
// Sans cette section, les trois suivantes seraient un goût. Elle établit que
// « par fragment » n'est pas une invention de cette tâche mais la loi d'à côté.
test('① le socle décide de la terre et de la mer DANS SON FRAGMENT', () => {
  // ⚠️ LE NUANCEUR DE FRAGMENT DE LA NAPPE DU SOCLE S'APPELLE `FRAG` TOUT COURT
  // (`src/ocean.js:378`) ; `SKIRT_FRAG`, plus bas, est celui de la JUPE. On borne
  // donc la tranche entre les deux, sinon la section lirait la jupe.
  const iFrag = ocean.indexOf('const FRAG = /* glsl */ `')
  assert.ok(iFrag >= 0, 'le nuanceur de fragment de la nappe du socle est introuvable')
  const iFin = ocean.indexOf('const SKIRT_FRAG', iFrag)
  assert.ok(iFin > iFrag, 'SKIRT_FRAG introuvable — la borne de tranche a bougé')
  const frag = ocean.slice(iFrag, iFin)
  // il lit le champ, il ne reçoit pas une profondeur toute faite
  assert.match(frag, /texture2D\(uField,\s*uvF\)/, 'le fragment du socle ne lit plus uField')
  assert.match(frag, /float\s+depth\s*=\s*max\(uWaterY\s*-\s*f\.r/, 'la loi de profondeur du socle a changé')
  assert.match(frag, /float\s+shoreAA\s*=\s*smoothstep\(0\.0,\s*0\.02,\s*depth\)/, 'le trait d’eau du socle a changé')
})

// ── ② LE CROP LIT SON CHAMP À LA MÊME FRÉQUENCE ────────────────────────────
test('② le fragment de la nappe du crop lit uMerChamp lui-même', () => {
  assert.match(MER_FRAG, /uniform\s+sampler2D\s+uMerChamp\s*;/, 'uMerChamp n’est pas déclaré dans MER_FRAG')
  assert.match(MER_FRAG, /uniform\s+float\s+uMerParFragment\s*;/, 'uMerParFragment n’est pas déclaré')
  assert.match(MER_FRAG, /texture2D\(uMerChamp,\s*uvFrag\)/, 'le fragment ne lit pas le champ')
  // ⚠️ ET IL LE LIT SUR vCrop, PAS SUR LA POSITION DÉPLACÉE : la houle bouge les
  // sommets, `vCrop` est la coordonnée PARAMÉTRIQUE. Lire l'autre ferait onduler
  // le trait de côte au rythme des vagues — un défaut qui ne se voit qu'en
  // mouvement, donc jamais sur une capture au repos.
  assert.match(MER_FRAG, /vec2\s+uvFrag\s*=\s*vCrop\s*\/\s*\(2\.0\s*\*\s*uMerPortee\)\s*\+\s*0\.5\s*;/,
    'l’UV du fragment n’est plus celui du vertex')
  const uvVert = /vec2\s+uvF\s*=\s*aCrop\s*\/\s*\(2\.0\s*\*\s*uMerPortee\)\s*\+\s*0\.5\s*;/
  assert.match(MER_VERT, uvVert, 'l’UV du vertex a changé — les deux lectures divergeraient')
})

// ── ③ LA MÊME LOI, PAS UNE SECONDE ÉCRITURE ────────────────────────────────
//
// ⚠️ **C'EST LA GARDE QUI COMPTE LE PLUS.** Ce dépôt raconte sept fois
// l'accident de la « seconde écriture jumelle » (l'écume de P4, le corps d'eau
// de P6, le chop de P5). Changer la fréquence d'échantillonnage était légitime ;
// recopier les trois lois d'`ecume-mer.js` dans le fragment ne l'aurait pas été.
test('③ le fragment appelle les MÊMES fonctions que le vertex, pas des copies', () => {
  for (const f of ['profondeurEauMer', 'declinRivageMer', 'fonduRessacMer']) {
    assert.ok(MER_VERT.includes(f + '('), `le vertex n’appelle plus ${f}`)
    assert.ok(MER_FRAG.includes(f + '('), `le fragment n’appelle pas ${f}`)
  }
  // aucune des trois n'est REDÉFINIE dans le fichier : elles arrivent par
  // GLSL_ECUME, injecté des deux côtés.
  for (const f of ['profondeurEauMer', 'declinRivageMer', 'fonduRessacMer']) {
    assert.ok(!new RegExp(`float\\s+${f}\\s*\\(`).test(globe), `${f} est redéfinie dans globe.js`)
  }
  const ecume = readFileSync(new URL('../src/monde/ecume-mer.js', import.meta.url), 'utf8')
  for (const f of ['profondeurEauMer', 'declinRivageMer', 'fonduRessacMer']) {
    assert.match(ecume, new RegExp(`float\\s+${f}\\s*\\(`), `${f} n’est plus dans ecume-mer.js`)
  }
})

// ── ④ PLUS AUCUN CONSOMMATEUR NE LIT LE VARYING ────────────────────────────
//
// ⚠️ **C'EST ICI QUE LE DÉFAUT REVIENDRAIT.** Il suffit qu'un seul des cinq
// consommateurs garde son varying pour que la moitié du trait redevienne
// polygonale, sans qu'aucune capture au repos ne le dise. On compte donc les
// occurrences APRÈS le bloc de calcul.
test('④ les cinq consommateurs du fragment lisent la valeur PAR FRAGMENT', () => {
  const i = MER_FRAG.indexOf('float fonduRive = vFonduRive;')
  assert.ok(i > 0, 'le bloc de calcul par fragment a disparu')
  const apres = MER_FRAG.slice(i + 'float fonduRive = vFonduRive;'.length)
  for (const v of ['vProfondeurEau', 'vFonduRive']) {
    assert.ok(!apres.includes(v), `${v} est encore lu après le bloc de calcul`)
  }
  // `vProfondeur` reste légitime dans le VERTEX (le critère de déferlement s'en
  // sert), mais plus dans le corps du fragment.
  assert.ok(!/[^v]vProfondeur[^E]/.test(apres.replace(/\/\/[^\n]*/g, '')),
    'vProfondeur est encore lu après le bloc de calcul')
  assert.match(apres, /float dLagon = clamp\(profondeurEau/, 'le glacis de lagon ne lit pas la valeur par fragment')
  assert.match(apres, /decalageRefraction\(nLocal\.xz, uMerRefract, fonduRive\)/, 'la réfraction ne lit pas la valeur par fragment')
  assert.match(apres, /ecumeMer\(vCrete, fonduRive,/, 'l’écume ne lit pas la valeur par fragment')
  assert.equal((apres.match(/smoothstep\(0\.0, uMerSeuilEau, profondeurEau\)/g) || []).length, 2,
    'les DEUX alphas doivent lire la valeur par fragment')
  // et le discard de terre aussi
  assert.match(MER_FRAG, /if \(profondeur <= 0\.0\) discard;/, 'le discard de terre lit encore le varying')
})

// ── ⑤ LA LIVRAISON EST ALLUMÉE ─────────────────────────────────────────────
//
// ⚠️ **UN INTERRUPTEUR POSÉ À ZÉRO EST UNE TÂCHE QUI N'A RIEN LIVRÉ.** Ce dépôt
// en a l'exemple : `socleVisible` a existé, testé et muté, pendant des jours
// sans qu'un seul appelant le lise.
test('⑤ `poserMer` pose uMerParFragment à 1', () => {
  assert.match(globe, /uMerParFragment:\s*\{\s*value:\s*1\s*\}/,
    'uMerParFragment n’est pas posé à 1 par poserMer')
})

// ═══════════ ⑥ LE BLOC PAR FRAGMENT, **EXÉCUTÉ** — TOUR DE CORRECTION ══════
//
// ⛔ **CINQ MUTANTS ONT SURVÉCU AUX 4 200 TESTS, ET DEUX D'ENTRE EUX ÉTEIGNENT
// LA LIVRAISON ENTIÈRE.** La relecture les a posés et rejoués :
//
// | mutation | ce qu'elle fait |
// |---|---|
// | `if (uMerParFragment > 0.5)` → `< 0.5` | l'uniforme reste à 1, le bloc ne court plus, **l'image d'avant revient** |
// | `if (uMerParFragment > 0.5)` → `if (false)` | idem, en plus franc |
// | `max(-champFrag.r …)` → `.g` | la profondeur est prise sur la DISTANCE |
// | `declinRivageMer(…, champFrag.r)` au lieu de `.g` | le déclin côtier est pris sur la BATHYMÉTRIE |
// | `profondeurEauMer(…, uMerUnite)` → `…, 1.0` | le repli n'est plus converti en unités de scène |
//
// **Les sections ① à ⑤ n'en tuent aucune, et la cause est structurelle** :
// elles lisent le TEXTE SOURCE. ⑤ vérifie que l'interrupteur est **posé** à 1 ;
// aucune ne vérifie que la garde le **lit dans le bon sens** — et un `if` dont
// personne ne teste le sens rend une livraison silencieusement réversible.
//
// ➡️ **On ne cherche donc plus ces lignes : on les EXÉCUTE**, exactement comme
// `test/eau-refraction.test.js` ⑦ le fait déjà sur le même nuanceur. Le bloc est
// **découpé dans le vrai fichier** (de `float profondeur =` jusqu'au `discard;`
// de la terre), analysé, et couru avec un `texture2D` bouchon qui NOTE la
// coordonnée qu'on lui demande.
//
// ⚠️ **AUCUNE FORMULE N'EST RÉÉCRITE ICI.** Les trois fonctions du GLSL sont
// branchées sur **leurs jumelles JS d'`ecume-mer.js`** — ce que
// `test/ecume-mer.test.js` ②a, ⑦c et ② (`fonduRessacMer`) autorisent : ils
// prouvent déjà, en exécutant le GLSL traduit, que les deux écritures calculent
// la même chose à 1e-12 près. Ce que cette section ajoute est ce que celles-là
// ne regardent pas : **QUELS arguments ce bloc-ci leur passe, et DANS QUEL CAS
// il les appelle.**
//
// ⚠️ **CE QUE ÇA NE PROUVE TOUJOURS PAS** : que le GPU exécute ce texte. Cela
// prouve que le texte, exécuté, décide de la terre et de la mer sur le champ
// qu'il lit lui-même, à l'endroit où le vertex le lit, et **seulement quand
// l'interrupteur est levé**. L'image, c'est `.banc/R5/` qui la porte.

// ── un interpréteur GLSL minuscule : lexique, analyse, exécution ────────────
//
// ⚠️ **IL NE CONNAÎT QUE CE QUE LE BLOC CONTIENT**, et c'est délibéré : tout
// jeton, tout appel, tout nom libre qu'il ne sait pas traiter **fait échouer le
// test** au lieu de valoir `undefined`. Une mutation qui introduirait autre
// chose rougirait donc, faute de pouvoir se taire.

const TYPES = new Set(['float', 'vec2', 'vec3', 'vec4', 'int', 'bool'])
const CANAUX = { x: 0, y: 1, z: 2, w: 3, r: 0, g: 1, b: 2, a: 3 }
const DOUBLES = ['<=', '>=', '==', '!=', '&&', '||']

function jetons(src) {
  const out = []
  let i = 0
  while (i < src.length) {
    const c = src[i]
    if (/\s/.test(c)) { i++; continue }
    if (c === '/' && src[i + 1] === '/') { while (i < src.length && src[i] !== '\n') i++; continue }
    if (/[0-9]/.test(c) || (c === '.' && /[0-9]/.test(src[i + 1] || ''))) {
      const m = /^[0-9]*\.?[0-9]+(?:[eE][-+]?[0-9]+)?/.exec(src.slice(i))
      out.push({ t: 'nombre', v: Number(m[0]) }); i += m[0].length; continue
    }
    if (/[A-Za-z_]/.test(c)) {
      const m = /^[A-Za-z_]\w*/.exec(src.slice(i))
      out.push({ t: 'mot', v: m[0] }); i += m[0].length; continue
    }
    const deux = src.slice(i, i + 2)
    if (DOUBLES.includes(deux)) { out.push({ t: 'op', v: deux }); i += 2; continue }
    if ('+-*/().,;{}<>=!'.includes(c)) { out.push({ t: 'op', v: c }); i++; continue }
    throw new Error(`GLSL : caractère non traduit « ${c} »`)
  }
  return out
}

function analyse(source) {
  const js = jetons(source)
  let p = 0
  const est = (v) => Boolean(js[p]) && js[p].v === v
  const avale = (v) => { assert.ok(est(v), `GLSL : « ${v} » attendu, « ${js[p] && js[p].v} » trouvé`); return js[p++] }

  function primaire() {
    const j = js[p++]
    assert.ok(j, 'GLSL : expression tronquée')
    if (j.t === 'nombre') return { k: 'n', v: j.v }
    if (j.v === '(') { const e = expression(); avale(')'); return e }
    assert.equal(j.t, 'mot', `GLSL : jeton inattendu « ${j.v} »`)
    if (est('(')) {
      avale('(')
      const args = []
      if (!est(')')) { args.push(expression()); while (est(',')) { avale(','); args.push(expression()) } }
      avale(')')
      return { k: 'appel', nom: j.v, args }
    }
    return { k: 'nom', nom: j.v }
  }
  function suffixe() {
    let e = primaire()
    while (est('.')) {
      avale('.')
      const m = js[p++]
      assert.ok(m && m.t === 'mot', 'GLSL : swizzle attendu après le point')
      e = { k: 'canaux', sur: e, canaux: m.v }
    }
    return e
  }
  function unaire() {
    if (est('-')) { avale('-'); return { k: 'moins', sur: unaire() } }
    if (est('+')) { avale('+'); return unaire() }
    return suffixe()
  }
  function multiplicatif() {
    let g = unaire()
    while (est('*') || est('/')) { const o = js[p++].v; g = { k: 'bin', o, g, d: unaire() } }
    return g
  }
  function additif() {
    let g = multiplicatif()
    while (est('+') || est('-')) { const o = js[p++].v; g = { k: 'bin', o, g, d: multiplicatif() } }
    return g
  }
  function expression() {
    let g = additif()
    while (['<', '>', '<=', '>=', '==', '!='].some((o) => est(o))) { const o = js[p++].v; g = { k: 'bin', o, g, d: additif() } }
    return g
  }
  function bloc() {
    avale('{')
    const s = []
    while (!est('}')) { assert.ok(p < js.length, 'GLSL : accolade non refermée'); s.push(instruction()) }
    avale('}')
    return s
  }
  function instruction() {
    if (est('if')) {
      avale('if'); avale('(')
      const cond = expression()
      avale(')')
      return { k: 'si', cond, alors: est('{') ? bloc() : [instruction()] }
    }
    if (est('discard')) { avale('discard'); avale(';'); return { k: 'discard' } }
    let j = js[p++]
    assert.ok(j && j.t === 'mot', `GLSL : instruction non reconnue près de « ${j && j.v} »`)
    let declare = false
    if (TYPES.has(j.v)) { declare = true; j = js[p++]; assert.ok(j && j.t === 'mot', 'GLSL : nom attendu après le type') }
    avale('=')
    const val = expression()
    avale(';')
    return { k: 'pose', nom: j.v, declare, val }
  }

  const prog = []
  while (p < js.length) prog.push(instruction())
  return prog
}

/** Le `discard` du GLSL : il sort du fragment, il ne rend pas une couleur. */
class Rejet extends Error {}

const OPERATEURS = {
  '+': (x, y) => x + y, '-': (x, y) => x - y, '*': (x, y) => x * y, '/': (x, y) => x / y,
  '>': (x, y) => x > y, '<': (x, y) => x < y, '>=': (x, y) => x >= y, '<=': (x, y) => x <= y,
  '==': (x, y) => x === y, '!=': (x, y) => x !== y,
}

function binaire(o, a, b) {
  const f = OPERATEURS[o]
  assert.ok(f, `GLSL : opérateur « ${o} » non traduit`)
  const va = Array.isArray(a); const vb = Array.isArray(b)
  if (!va && !vb) return f(a, b)
  const n = va ? a.length : b.length
  return Array.from({ length: n }, (_, i) => f(va ? a[i] : a, vb ? b[i] : b))
}

/** Les fonctions natives du GLSL, en version composante par composante. */
const parComposante = (f) => (...a) => {
  if (a.every((v) => !Array.isArray(v))) return f(...a)
  const n = Math.max(...a.map((v) => (Array.isArray(v) ? v.length : 1)))
  return Array.from({ length: n }, (_, i) => f(...a.map((v) => (Array.isArray(v) ? v[i] : v))))
}

function evalue(n, env, outils) {
  if (n.k === 'n') return n.v
  if (n.k === 'nom') {
    assert.ok(n.nom in env, `le bloc lit « ${n.nom} », que ce test ne sait pas nourrir — nomme-le`)
    return env[n.nom]
  }
  if (n.k === 'moins') { const v = evalue(n.sur, env, outils); return Array.isArray(v) ? v.map((x) => -x) : -v }
  if (n.k === 'bin') return binaire(n.o, evalue(n.g, env, outils), evalue(n.d, env, outils))
  if (n.k === 'canaux') {
    const v = evalue(n.sur, env, outils)
    assert.ok(Array.isArray(v), 'GLSL : swizzle demandé sur un scalaire')
    const idx = [...n.canaux].map((c) => { assert.ok(c in CANAUX, `GLSL : canal « ${c} » inconnu`); return CANAUX[c] })
    return idx.length === 1 ? v[idx[0]] : idx.map((i) => v[i])
  }
  if (n.k === 'appel') {
    assert.ok(n.nom in outils, `le bloc appelle « ${n.nom} », que ce test ne sait pas exécuter — branche-le`)
    return outils[n.nom](...n.args.map((a) => evalue(a, env, outils)))
  }
  throw new Error('GLSL : nœud inconnu')
}

function courir(prog, env, outils) {
  for (const s of prog) {
    if (s.k === 'discard') throw new Rejet()
    if (s.k === 'si') { if (evalue(s.cond, env, outils)) courir(s.alors, env, outils); continue }
    if (!s.declare) assert.ok(s.nom in env, `le bloc écrit « ${s.nom} » sans l’avoir déclaré`)
    env[s.nom] = evalue(s.val, env, outils)
  }
  return env
}

// ── le bloc, découpé dans le VRAI fichier ──────────────────────────────────

/** De `float profondeur =` jusqu'au `discard;` de la terre, inclus. */
function blocParFragment(frag) {
  const i = frag.indexOf('float profondeur =')
  assert.ok(i > 0, 'le bloc par fragment a disparu de MER_FRAG')
  const j = frag.indexOf('discard;', i)
  assert.ok(j > i, 'le discard de terre ne suit plus le bloc par fragment')
  return frag.slice(i, j + 'discard;'.length)
}

/** La ligne d'UV du VERTEX — on COMPARE les deux lectures au lieu de recopier la loi. */
function ligneUvVertex(vert) {
  const i = vert.indexOf('vec2 uvF =')
  assert.ok(i > 0, 'l’UV du vertex a disparu de MER_VERT')
  const j = vert.indexOf(';', i)
  return vert.slice(i, j + 1)
}

// Des nombres CHOISIS ICI, tous distincts, tous hors des points de saturation :
// aucune confusion d'opérande, de canal ou de varying ne peut passer inaperçue.
const V_CROP = [0.6, -1.2]                  // la coordonnée paramétrique du fragment
const PORTEE = 3                            // uMerPortee — l'emprise du crop
const UNITE = 4                             // uMerUnite — unités de scène par unité de socle
const CHAMP_MER = [-0.02, 0.3, 0.44, 0.55]  // r : le fond SOUS zéro ; g : la distance au rivage
const CHAMP_TERRE = [0.05, 0.3, 0.44, 0.55] // le MÊME g, mais un fond AU-DESSUS de zéro
const VARYINGS = { vProfondeur: 0.11, vProfondeurEau: 0.22, vFonduRive: 0.33 }

const OUTILS_GLSL = {
  max: parComposante(Math.max),
  min: parComposante(Math.min),
  abs: parComposante(Math.abs),
  clamp: parComposante((x, a, b) => Math.min(Math.max(x, a), b)),
  // ⚠️ **LES JUMELLES JS, PAS UNE RÉÉCRITURE** — voir l'en-tête de la section.
  profondeurEauMer: profondeurEau,
  declinRivageMer: declinRivage,
  fonduRessacMer: fonduRessac,
}

/**
 * Court le bloc pour un interrupteur et un champ donnés.
 * Rend `{ env, lectures, rejete }` ; `lectures` note CHAQUE échantillonnage.
 */
function courirBlocMer({ parFragment, champ }) {
  const prog = analyse(blocParFragment(MER_FRAG))
  const lectures = []
  const env = Object.assign(Object.create(null), VARYINGS, {
    uMerParFragment: parFragment,
    uMerPortee: PORTEE,
    uMerUnite: UNITE,
    vCrop: [...V_CROP],
    uMerChamp: 'le champ du crop',
  })
  const outils = {
    ...OUTILS_GLSL,
    texture2D: (echantillonneur, uv) => { lectures.push([echantillonneur, uv]); return [...champ] },
  }
  try {
    courir(prog, env, outils)
  } catch (e) {
    if (e instanceof Rejet) return { env, lectures, rejete: true }
    throw e
  }
  return { env, lectures, rejete: false }
}

const PRES = 1e-15

test('⑥ interrupteur LEVÉ : les trois grandeurs viennent du CHAMP, pas des varyings — exécuté', () => {
  const { env, lectures, rejete } = courirBlocMer({ parFragment: 1, champ: CHAMP_MER })
  assert.equal(rejete, false, 'le fragment discarde alors que le fond est sous le niveau zéro')

  // ① le champ est lu UNE fois, et sur le bon échantillonneur
  assert.equal(lectures.length, 1, 'le champ doit être échantillonné exactement une fois')
  assert.equal(lectures[0][0], 'le champ du crop', 'le fragment n’échantillonne pas uMerChamp')

  // ② À L'ENDROIT MÊME OÙ LE VERTEX LE LIT — la loi n'est pas recopiée ici, elle
  //    est EXÉCUTÉE des deux côtés et les deux résultats sont comparés.
  const vertex = courir(analyse(ligneUvVertex(MER_VERT)), Object.assign(Object.create(null), {
    aCrop: [...V_CROP], uMerPortee: PORTEE,
  }), OUTILS_GLSL)
  assert.ok(Math.abs(lectures[0][1][0] - vertex.uvF[0]) < PRES,
    `u ${lectures[0][1][0]} contre ${vertex.uvF[0]} — les deux lectures divergent`)
  assert.ok(Math.abs(lectures[0][1][1] - vertex.uvF[1]) < PRES,
    `v ${lectures[0][1][1]} contre ${vertex.uvF[1]} — les deux lectures divergent`)
  // le témoin : l'UV d'essai n'est pas le centre, donc les deux lignes ci-dessus
  // ne sont pas vraies pour rien.
  assert.ok(Math.abs(vertex.uvF[0] - 0.5) > 1e-6 && Math.abs(vertex.uvF[1] - 0.5) > 1e-6,
    'le témoin ne vaut rien : l’UV d’essai tombe au centre du champ')

  // ③ LA PROFONDEUR EST L'OPPOSÉ DU CANAL R — le fond marin, pas la distance
  assert.ok(Math.abs(env.profondeur - (-CHAMP_MER[0])) < PRES,
    `profondeur ${env.profondeur} : elle n’est pas prise sur la bathymétrie`)
  // ④ LE REPLI EST CONVERTI EN UNITÉS DE SCÈNE — `uMerUnite`, et pas 1
  assert.ok(Math.abs(env.profondeurEau - profondeurEau(env.profondeur, CHAMP_MER[1], UNITE)) < PRES,
    `profondeurEau ${env.profondeurEau}`)
  assert.ok(Math.abs(env.profondeurEau - profondeurEau(env.profondeur, CHAMP_MER[1], 1)) > 1e-3,
    'le témoin ne vaut rien : la conversion ne change pas le résultat sur ce champ d’essai')
  // ⑤ LE DÉCLIN CÔTIER LIT LA DISTANCE — canal G — et la profondeur RECONVERTIE
  assert.ok(Math.abs(env.fonduRive - fonduRessac(declinRivage(env.profondeur / UNITE, CHAMP_MER[1]))) < PRES,
    `fonduRive ${env.fonduRive}`)
  assert.ok(env.fonduRive > 0.01 && env.fonduRive < 0.99,
    `le témoin ne vaut rien : fonduRive ${env.fonduRive} est saturé`)
  assert.ok(Math.abs(env.fonduRive - fonduRessac(declinRivage(env.profondeur / UNITE, CHAMP_MER[0]))) > 1e-3,
    'le témoin ne vaut rien : le canal du déclin côtier ne change pas le résultat')

  // ⑥ ET AUCUNE DES TROIS N'EST RESTÉE SUR SON VARYING
  const sorties = { vProfondeur: env.profondeur, vProfondeurEau: env.profondeurEau, vFonduRive: env.fonduRive }
  for (const nom of Object.keys(VARYINGS)) {
    assert.ok(Math.abs(sorties[nom] - VARYINGS[nom]) > 1e-3, `${nom} : la valeur du varying a traversé le bloc`)
  }
})

test('⑥ interrupteur BAISSÉ : le champ n’est PAS lu et les varyings passent — exécuté', () => {
  // ⛔ **C'EST LA MOITIÉ QUI TUE `> 0.5` → `< 0.5`.** Un interrupteur dont on ne
  // teste qu'un seul état ne teste rien : la garde inversée rend le même vert.
  const { env, lectures, rejete } = courirBlocMer({ parFragment: 0, champ: CHAMP_MER })
  assert.equal(rejete, false)
  assert.equal(lectures.length, 0, 'interrupteur baissé, le champ ne doit pas être échantillonné')
  assert.equal(env.profondeur, VARYINGS.vProfondeur)
  assert.equal(env.profondeurEau, VARYINGS.vProfondeurEau)
  assert.equal(env.fonduRive, VARYINGS.vFonduRive)
})

test('⑥ la TERRE discarde sur la bathymétrie NUE, pas sur le repli — exécuté', () => {
  // ⛔ Le repli distance-au-rivage est > 0 partout où la distance l'est, donc
  // AUSSI sur la terre : un discard posé dessus ne discarderait jamais et
  // NOIERAIT LA CÔTE. Le témoin le prouve dans le même souffle.
  const terre = courirBlocMer({ parFragment: 1, champ: CHAMP_TERRE })
  assert.equal(terre.rejete, true, 'un fond au-dessus du niveau zéro doit discarder')
  const mer = courirBlocMer({ parFragment: 1, champ: CHAMP_MER })
  assert.equal(mer.rejete, false, 'un fond sous le niveau zéro ne doit pas discarder')
  // le témoin : sur cette même terre, le repli est bien STRICTEMENT POSITIF —
  // c'est ce qui rend le choix du canal décisif et non décoratif.
  assert.ok(profondeurEau(0, CHAMP_TERRE[1], UNITE) > 0,
    'le témoin ne vaut rien : le repli est nul sur cette terre d’essai')
})
