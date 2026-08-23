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
