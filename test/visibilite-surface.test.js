// LES BOUTONS DU BAS — Tâche R1 ② du plan « LE STUDIO SUR LE GLOBE ».
//
// **Adrien, 2026-08-23 :** « Il me manque les boutons du bas en UI, ils ont
// disparu (shuffle, affichage photographie aérienne...) »
//
// ══════════ CE QUE CE FICHIER GARDE ════════════════════════════════════════
//
//   ① LA LOI — deux questions, deux réponses. Le bornage du drapeau tient sur
//      le maillage du bloc plat, et **ne déborde pas** sur l'interface.
//   ② LE COMPORTEMENT — un poseur de papier, câblé comme `main.js` l'est,
//      rendu drapeau levé puis drapeau baissé. ⚠️ **Il MORD sur ce qui est
//      posé aux calques et aux boutons, pas sur le texte source** : sur ce
//      chantier, une mutation a survécu à 4 082 tests parce que la garde était
//      une assertion d'expression régulière sur `main.js`.
//   ③ LE CÂBLAGE DE `main.js` — lu, pas chargé (aucun test de ce dépôt ne
//      charge `main.js`). Il ne prouve rien à lui seul ; il ferme la seule
//      chose que ① et ② ne peuvent pas atteindre.

import test from 'node:test'
import assert from 'node:assert/strict'
import { readFileSync } from 'node:fs'

import { visibiliteSurface } from '../src/monde/visibilite-surface.js'

const MAIN = readFileSync(new URL('../src/main.js', import.meta.url), 'utf8')

// ══════════════════════════════════════════════════════════════════ ① la loi

test('① DRAPEAU LEVÉ, en surface : le maillage plat est éteint, les boutons sont ALLUMÉS', () => {
  const v = visibiliteSurface({ terreUnique: true, surface: true })
  assert.equal(v.socle, false, 'le bloc plat revient — il y aurait DEUX Terres')
  assert.equal(v.boutons, true, 'les boutons du bas ont disparu — le défaut d’Adrien')
})

test('① DRAPEAU LEVÉ, hors surface : tout s’éteint, boutons compris', () => {
  // ⚠️ En orbite la planète EST le sujet : un raccourci isométrique « sur le
  // bloc » n'a plus de bloc, et le coin cartographie n'a plus de carte.
  const v = visibiliteSurface({ terreUnique: true, surface: false })
  assert.equal(v.socle, false)
  assert.equal(v.boutons, false, 'les boutons de surface survivent à l’orbite')
})

test('① DRAPEAU BAISSÉ : la production est INCHANGÉE, les deux réponses se confondent', () => {
  // ⚠️ **C'EST LA GARANTIE QUE TOUT CE CHANTIER A TENUE JUSQU'ICI**, et elle
  // vaut dans les deux sens : sans drapeau, `socle` et `boutons` sont le même
  // booléen, celui d'avant la tâche, au bit près.
  for (const surface of [true, false]) {
    const v = visibiliteSurface({ terreUnique: false, surface })
    assert.equal(v.socle, surface)
    assert.equal(v.boutons, surface)
  }
})

test('① les entrées molles sont ramenées à des booléens, pas propagées telles quelles', () => {
  // ⚠️ `setVisible(undefined)` et `mesh.visible = undefined` ne sont pas des
  // erreurs, ce sont des faux SILENCIEUX — et `visible = 0` casse three.js plus
  // loin, pas ici. On borne au bord.
  for (const e of [undefined, null, 0, '', NaN]) {
    const v = visibiliteSurface({ terreUnique: false, surface: e })
    assert.equal(v.socle, false); assert.equal(v.boutons, false)
  }
  for (const e of [1, 'oui', {}]) {
    const v = visibiliteSurface({ terreUnique: false, surface: e })
    assert.equal(v.socle, true); assert.equal(v.boutons, true)
  }
})

// ═══════════════════════════════════════════════════════ ② le comportement

// Le poseur de papier : câblé EXACTEMENT comme `poserVisibiliteSocle` l'est
// dans `main.js` — les calques du bloc plat sur `socle`, les trois boutons sur
// `boutons`. ⚠️ **Il ne recopie pas la LOI**, il la consomme : muter
// `visibilite-surface.js` fait rougir ce test, ce qui est tout l'objet.
function poseurDePapier(terreUnique) {
  const etat = {
    maillage: null, calques: {}, isoBtn: null, cineBtn: null, mapCorner: null,
  }
  return {
    etat,
    poser(v) {
      const vue = visibiliteSurface({ terreUnique, surface: v })
      etat.maillage = vue.socle
      // un échantillon des quatorze calques qui APPARTIENNENT au bloc plat
      etat.calques = { labels: vue.socle, nuages: vue.socle, socleBas: vue.socle, mer: vue.socle }
      etat.isoBtn = vue.boutons
      etat.cineBtn = vue.boutons
      etat.mapCorner = vue.boutons
    },
  }
}

test('② DRAPEAU LEVÉ : `terrain.mesh.visible` reste FAUX pendant que les trois boutons s’affichent', () => {
  const p = poseurDePapier(true)
  p.poser(true) // l'automate du seuil dit « on est en surface, devant un bloc »
  assert.equal(p.etat.maillage, false, 'le maillage du bloc plat est dessiné sous le drapeau')
  for (const [nom, v] of Object.entries(p.etat.calques)) {
    assert.equal(v, false, `le calque \`${nom}\` du bloc plat est allumé sous le drapeau`)
  }
  assert.equal(p.etat.isoBtn, true, 'le bouton isométrie est resté caché')
  assert.equal(p.etat.cineBtn, true, 'le bouton cinéma est resté caché')
  assert.equal(p.etat.mapCorner, true, 'le coin cartographie (aérien · base · shuffle) est resté caché')
})

test('② DRAPEAU BAISSÉ : rien ne change, boutons et maillage suivent le MÊME booléen', () => {
  const p = poseurDePapier(false)
  p.poser(true)
  assert.deepEqual(
    { m: p.etat.maillage, i: p.etat.isoBtn, c: p.etat.cineBtn, k: p.etat.mapCorner },
    { m: true, i: true, c: true, k: true },
  )
  p.poser(false)
  assert.deepEqual(
    { m: p.etat.maillage, i: p.etat.isoBtn, c: p.etat.cineBtn, k: p.etat.mapCorner },
    { m: false, i: false, c: false, k: false },
  )
})

test('② l’ORBITE éteint les boutons, drapeau levé COMME baissé', () => {
  for (const drapeau of [true, false]) {
    const p = poseurDePapier(drapeau)
    p.poser(false)
    assert.equal(p.etat.isoBtn, false, `boutons allumés hors surface (drapeau ${drapeau})`)
    assert.equal(p.etat.mapCorner, false)
  }
})

// ═══════════════════════════════════════ ③ le câblage de `main.js`, LU

test('③ `poserVisibiliteSocle` consomme la loi et ne borne plus rien elle-même', () => {
  const i = MAIN.indexOf('function poserVisibiliteSocle(')
  assert.ok(i > 0, '`poserVisibiliteSocle` a disparu ou changé de nom')
  const corps = MAIN.slice(i, MAIN.indexOf('\n}', i))
  const code = corps.replace(/\/\/[^\n]*/g, '') // le corps CITE le drapeau en prose
  assert.ok(/const vue = visibiliteSurface\(\{ terreUnique: terreUniqueBranchee, surface: v \}\)/.test(code),
    'la loi n’est pas appelée : le bornage est reparti en clair dans `main.js`')
  // ⛔ **PLUS AUCUN SECOND BORNAGE.** C'est la ligne `if (terreUniqueBranchee) v = false`
  // qui a effacé les boutons ; la laisser à côté de la loi ferait deux vérités.
  assert.ok(!/terreUniqueBranchee/.test(code.replace(/visibiliteSurface\(\{[^}]*\}\)/, '')),
    '`terreUniqueBranchee` est encore lu dans le corps, hors de l’appel à la loi')
})

test('③ les trois boutons reçoivent `vue.boutons`, le maillage reçoit `vue.socle`', () => {
  const i = MAIN.indexOf('function poserVisibiliteSocle(')
  const corps = MAIN.slice(i, MAIN.indexOf('\n}', i)).replace(/\/\/[^\n]*/g, '')
  assert.ok(/terrain\.mesh\.visible = vue\.socle/.test(corps), 'le maillage ne suit pas `vue.socle`')
  for (const b of ['isoBtn', 'cineBtn', 'mapCorner']) {
    assert.ok(new RegExp(b + '\\?\\.setVisible\\(vue\\.boutons\\)').test(corps),
      `\`${b}\` ne suit pas \`vue.boutons\` — il est encore accroché au maillage`)
  }
  // et AUCUN des trois ne reçoit encore la grandeur du maillage
  for (const b of ['isoBtn', 'cineBtn', 'mapCorner']) {
    assert.ok(!new RegExp(b + '\\?\\.setVisible\\((v|vue\\.socle)\\)').test(corps),
      `\`${b}\` reçoit encore la visibilité du bloc plat`)
  }
})

test('③ `main.js` importe la loi plutôt que de la réécrire', () => {
  assert.ok(/import \{ visibiliteSurface \} from '\.\/monde\/visibilite-surface\.js'/.test(MAIN),
    'la loi n’est pas importée')
})
