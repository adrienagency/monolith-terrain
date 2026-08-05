// LA MER DU DAMIER, EXÉCUTÉE — pas relue.
//
// ⚠️ POURQUOI CE FICHIER EXISTE, ET POURQUOI L'EXCUSE « ocean.js TIRE THREE.JS »
// NE TENAIT PAS. Deux rondes de revue ont sanctionné des tests qui LISAIENT
// `src/ocean.js` au lieu de l'exécuter : on pouvait annuler entièrement une
// correction critique sans qu'un seul test ne rougisse. Le fichier était réputé
// intestable parce qu'il importe `ocean-waves`, un alias résolu par Vite.
//
// C'est faux : `node:module.registerHooks` résout cet alias en cinq lignes, et
// tout le reste (three, DataTexture, PlaneGeometry, BufferGeometry) fonctionne
// hors navigateur — aucune de ces classes n'a besoin d'un contexte WebGL pour
// être CONSTRUITE. On instancie donc la vraie `RealWater`, on la reconstruit sur
// un MNT bouchon, et on LIT ses uniformes, ses géométries et sa texture de champ.
//
// Ce que ce fichier prouve, et que `test/damier-mer.test.js` ne peut pas :
//   · le clip de la mer en mode continu vaut 27,78 — la valeur RÉELLE, pas une
//     absence de motif dans le texte (ronde 1, FINDING 1 ; ronde 2, FINDING 3) ;
//   · `recuireChamp()` recuit vraiment, et voit le damier tel qu'il est AU
//     MOMENT DU RECUIT (ronde 1, FINDING 3 ; ronde 2, FINDING 2) ;
//   · `echantillonSansGrain` interroge les voisines en coordonnées LOCALES ;
//   · un lac qui arrive après un recuit ne se pose pas sur une texture détruite.
import test from 'node:test'
import assert from 'node:assert/strict'
import { registerHooks } from 'node:module'
import { BlockGrid } from '../src/block-grid.js'
import { lacsMemoEcrire } from '../src/dem-memo.js'

// L'alias que Vite pose (vite.config.js) : la copie vendorée fait foi ici — la
// source LIVE d'ocean-lab peut ne pas être clonée sur la machine qui teste.
registerHooks({
  resolve(spec, ctx, suivant) {
    if (spec === 'ocean-waves') {
      return { url: new URL('../src/vendor/ocean-waves/index.js', import.meta.url).href, shortCircuit: true }
    }
    return suivant(spec, ctx)
  },
})
const { RealWater } = await import('../src/ocean.js')

const TERRAIN_SIZE = 56

// ── Le décor minimal : un MNT bouchon et un terrain qui répond ───────────────
// Une île centrale de rayon 20 : de la terre au milieu, de la mer autour. Il
// n'en faut pas plus — ce qu'on mesure, ce sont des uniformes et des tailles.
function faitTerrain(empriseCote = 1, hauteur = (x, z) => (Math.hypot(x, z) < 20 ? 1 : -1)) {
  const size = 8
  const dem = {
    data: new Float32Array(size * size),
    size,
    extentMeters: 20000 * empriseCote,
    meanM: 0,
    minM: -200,
    empriseCote,
    zoom: 12,
  }
  return {
    dem,
    mapUniforms: { uSeaY: { value: 0 } },
    sample: hauteur,
    sampleChamp: () => hauteur,
  }
}
const PARAMS = {
  waterReal: true, source: 'real', demExaggeration: 1, seaEdge: true,
  slabCorner: 0.05, slabCornerSmoothing: 0, seaWaveH: 0.5, seaChop: 0.7, seaSpeed: 1, detail: 0,
}

function batit({ empriseCote = 1, carre = null, fabriqueSol = null, planchier = null, hauteur } = {}) {
  const terrain = faitTerrain(empriseCote, hauteur)
  lacsMemoEcrire(terrain.dem, []) // fente pleine : pas de Worker, pas d'asynchrone
  const eau = new RealWater({ add() {} })
  eau.rebuild({ terrain, params: PARAMS, carre, fabriqueSol, planchier })
  return { eau, terrain }
}

const surface = (eau) => eau.materials.find((m) => m.name === 'real-water-sea')
const jupe = (eau) => eau.meshes.find((m) => m.material.name === 'real-water-skirt')
const plan = (eau) => eau.meshes.find((m) => m.material.name === 'real-water-sea')

// ════════ 1. LA FENÊTRE CONTINUE — le défaut de la ronde 0, en valeurs ══════
//
// ⚠️ CE TEST REMPLACE UN `doesNotMatch`. La ronde 2 a montré qu'on pouvait
// réintroduire le défaut par la voie la plus naturelle — passer `emprise.cote`
// là où va le côté géométrique — et qu'un seul verrou de TEXTE mourait. Ici on
// relève la valeur réelle du clip, et 83,78 en mode continu ne peut pas passer.
//
// Le fond du problème : en mode continu le CHAMP couvre trois blocs, mais le
// SOCLE en fait un — c'est le relief qui défile dedans. Une mer taillée sur le
// champ déborde de trois blocs de large sur la table, et rien ne l'arrête : la
// surface ne porte aucun plan de coupe, son seul arrêt est `uHalf`.
test('mode continu : la mer reste tenue dans UN bloc, valeurs relevees', () => {
  const { eau } = batit({ empriseCote: 3 })
  const mat = surface(eau)
  assert.equal(Number(mat.uniforms.uHalf.value.toFixed(2)), 27.78, 'le clip deborde du socle')
  assert.equal(Number(plan(eau).geometry.parameters.width.toFixed(3)), 55.888, 'la maille deborde du socle')
  assert.equal(plan(eau).geometry.parameters.widthSegments, 256, 'trois fois plus de quadrilateres pour un bloc')
  // … et le CHAMP, lui, couvre bien les trois blocs : c'est tout l'objet du
  // mode continu, et il ne doit surtout pas retomber à 56.
  assert.equal(mat.uniforms.uSpan.value, 168, 'le champ du mode continu a ete casse')
  assert.equal(eau._fieldTex.image.width, 1152)
})

// … et même si un carré de damier traîne dans les paramètres. Les deux modes ne
// coexistent pas (block-grid.js referme le damier dès que l'emprise est montée),
// mais rien dans le type ne l'empêche : c'est la ligne de défense.
test('mode continu : un carre de damier passe en meme temps ne change RIEN', () => {
  const seul = batit({ empriseCote: 3 })
  const avecCarre = batit({ empriseCote: 3, carre: { i0: -1, j0: -1, cote: 3 } })
  assert.equal(surface(avecCarre.eau).uniforms.uHalf.value, surface(seul.eau).uniforms.uHalf.value)
  assert.equal(plan(avecCarre.eau).geometry.parameters.width, plan(seul.eau).geometry.parameters.width)
  assert.equal(Number(surface(avecCarre.eau).uniforms.uHalf.value.toFixed(2)), 27.78)
})

// ════════════ 2. LE DAMIER — la mer couvre bien tout le carré ═══════════════

test('damier 3x3 : clip, maille, champ et centre, valeurs relevees', () => {
  const { eau } = batit({ carre: { i0: -1, j0: -1, cote: 3 } })
  const mat = surface(eau)
  assert.equal(Number(mat.uniforms.uHalf.value.toFixed(2)), 83.78)
  assert.equal(mat.uniforms.uSpan.value, 168)
  assert.equal(mat.uniforms.uSpanMasque.value, TERRAIN_SIZE, 'le masque cotier suit le MNT, pas le carre')
  assert.equal(eau._fieldTex.image.width, 1152)
  assert.equal(plan(eau).geometry.parameters.widthSegments, 384)
  assert.deepEqual([mat.uniforms.uCentre.value.x, mat.uniforms.uCentre.value.y], [0, 0])
})

test('un bloc seul rend EXACTEMENT ce qu\'il rendait avant le damier', () => {
  const nu = batit()
  const un = batit({ carre: { i0: 0, j0: 0, cote: 1 } })
  for (const eau of [nu.eau, un.eau]) {
    const mat = surface(eau)
    assert.equal(Number(mat.uniforms.uHalf.value.toFixed(2)), 27.78)
    assert.equal(mat.uniforms.uSpan.value, 56)
    assert.equal(eau._fieldTex.image.width, 384)
    assert.equal(plan(eau).geometry.parameters.widthSegments, 256)
    assert.equal(Number(plan(eau).geometry.parameters.width.toFixed(3)), 55.888)
  }
})

// ⚠️ LE PIÈGE DU CÔTÉ PAIR, relevé sur la géométrie POSÉE. Un 2x2 ancré en
// (−1,−1) a son centre sur la jointure : la surface et la jupe doivent être
// translatées de (−28, −28), et le clip mesuré depuis ce point.
test('damier 2x2 : la surface ET la jupe sont posees sur la jointure', () => {
  const { eau } = batit({ carre: { i0: -1, j0: -1, cote: 2 } })
  const mat = surface(eau)
  assert.equal(Number(mat.uniforms.uHalf.value.toFixed(2)), 55.78)
  assert.deepEqual([mat.uniforms.uCentre.value.x, mat.uniforms.uCentre.value.y], [-28, -28])
  // la géométrie porte le décalage (le shader lit position.xz comme du monde)
  for (const maille of [plan(eau).geometry, jupe(eau).geometry]) {
    maille.computeBoundingBox()
    const b = maille.boundingBox
    const cx = (b.min.x + b.max.x) / 2
    const cz = (b.min.z + b.max.z) / 2
    assert.ok(Math.abs(cx + 28) < 1e-4, `centre x ${cx}, attendu -28`)
    assert.ok(Math.abs(cz + 28) < 1e-4, `centre z ${cz}, attendu -28`)
  }
})

test('la jupe descend au plancher commun, et ne remonte jamais', () => {
  const haut = batit({ carre: { i0: -1, j0: -1, cote: 3 }, planchier: 1000 })
  const bas = batit({ carre: { i0: -1, j0: -1, cote: 3 }, planchier: -1000 })
  const sans = batit({ carre: { i0: -1, j0: -1, cote: 3 } })
  const fond = (e) => jupe(e).material.uniforms.uBottomY.value
  assert.equal(fond(haut.eau), fond(sans.eau), 'un plancher HAUT a raccourci la jupe')
  assert.equal(fond(bas.eau), -1000, 'un plancher BAS n\'a pas allonge la jupe')
})

// ═══════ 3. LE RECUIT DIFFÉRÉ — il recuit, et il voit le damier D'ALORS ═════
//
// ⚠️ LA MUTATION QUE CE TEST EXISTE POUR TUER : `recuireChamp() { return false }`.
// Elle passait sur 250 tests en ronde 2. Le scénario réel : le carré s'ouvre dès
// la PREMIÈRE voisine, les six ou sept suivantes ne changent plus sa forme et ne
// reconstruisent donc rien. Sans recuit, leur relief reste absent du champ —
// c'est-à-dire PAS DE MER là où le bord du bloc central est de la terre.
test('recuireChamp recuit vraiment, et lit le damier tel qu\'il est ALORS', () => {
  // une fabrique dont l'échantillonneur CHANGE entre deux appels : c'est
  // exactement ce que fait une dalle qui atterrit.
  let arrivee = false
  const fabriqueSol = () => (arrivee ? () => -5 : () => +5) // terre partout, puis mer partout
  const { eau } = batit({ carre: { i0: -1, j0: -1, cote: 3 }, fabriqueSol })

  const sousLEau = (tex) => {
    const d = tex.image.data
    let n = 0
    for (let k = 0; k < d.length; k += 2) if (d[k] & 0x8000) n++ // demi-flottant négatif
    return n / (d.length / 2)
  }
  const avant = eau._fieldTex
  assert.equal(sousLEau(avant), 0, 'le champ de depart devrait etre tout en terre')

  arrivee = true
  assert.equal(eau.recuireChamp(), true)
  const apres = eau._fieldTex
  assert.notEqual(apres, avant, 'la texture du champ n\'a pas ete remplacee')
  assert.equal(sousLEau(apres), 1, 'le recuit n\'a pas vu l\'arrivee de la dalle')
  // … et tous les matériaux pointent la NOUVELLE texture, pas l'ancienne
  for (const m of eau.materials) if (m.uniforms.uField) assert.equal(m.uniforms.uField.value, apres)
})

// ⚠️ ET LA FABRIQUE EST LA RAISON POUR LAQUELLE ÇA MARCHE. Avec un
// échantillonneur FIGÉ à la reconstruction, `recuireChamp()` rendrait `true` et
// ne changerait rien : le recuit tournerait pour rien, ce qui est pire qu'un
// recuit absent (on paie la cuisson sans le résultat).
test('un echantillonneur fige rendrait le recuit inutile', () => {
  let arrivee = false
  const echFige = () => (arrivee ? -5 : +5)
  const { eau } = batit({ carre: { i0: -1, j0: -1, cote: 3 }, fabriqueSol: () => echFige })
  const sousLEau = (tex) => {
    const d = tex.image.data
    let n = 0
    for (let k = 0; k < d.length; k += 2) if (d[k] & 0x8000) n++
    return n / (d.length / 2)
  }
  arrivee = true
  eau.recuireChamp()
  // celui-là VOIT le changement parce que la fabrique est rappelée : c'est la
  // démonstration que le contrat « fabrique, pas échantillonneur » porte tout.
  assert.equal(sousLEau(eau._fieldTex), 1)
})

// ⚠️ L'ÉCHÉANCE S'ANNULE QUAND LE DAMIER SE REFERME, ET C'EST L'ORDRE DES DEUX
// LIGNES QUI LE DIT. Sortir sur le garde AVANT d'annuler laisse un minuteur
// armé derrière soi : des dalles se posent, l'échéance part à 300 ms, puis le
// damier se referme dans l'intervalle — la croix du profil, ou la fenêtre
// continue qui referme le damier. Trois cents millisecondes plus tard on
// recuirait un champ qu'on vient de reconstruire, ~41 ms de fil principal jetés
// pile quand l'utilisateur vient d'attraper la carte.
test('le damier qui se referme ANNULE l\'echeance de recuit', (t) => {
  t.mock.timers.enable({ apis: ['setTimeout'] })
  let recuits = 0
  const { eau } = batit({ carre: { i0: -1, j0: -1, cote: 3 }, fabriqueSol: () => () => -5 })
  eau.recuireChamp = () => { recuits++; return true }

  assert.equal(eau.recuireChampDiffere(3), true, 'l\'echeance ne s\'arme pas')
  t.mock.timers.tick(100) // … des dalles arrivent, on est encore dans l'intervalle
  assert.equal(eau.recuireChampDiffere(1), false, 'le damier referme ne devrait rien armer')
  t.mock.timers.tick(5000)
  assert.equal(recuits, 0, 'une cuisson est partie APRES le demontage du damier')
})

test('les arrivees successives fondent en UN seul recuit', (t) => {
  t.mock.timers.enable({ apis: ['setTimeout'] })
  let recuits = 0
  const { eau } = batit({ carre: { i0: -1, j0: -1, cote: 3 }, fabriqueSol: () => () => -5 })
  eau.recuireChamp = () => { recuits++; return true }
  for (let i = 0; i < 8; i++) { eau.recuireChampDiffere(3); t.mock.timers.tick(100) }
  assert.equal(recuits, 0, 'une cuisson est partie AVANT la fin de la rafale')
  t.mock.timers.tick(5000)
  assert.equal(recuits, 1, `${recuits} cuissons pour huit arrivees`)
})

test('une reconstruction emporte l\'echeance en vol', (t) => {
  t.mock.timers.enable({ apis: ['setTimeout'] })
  let recuits = 0
  const { eau, terrain } = batit({ carre: { i0: -1, j0: -1, cote: 3 }, fabriqueSol: () => () => -5 })
  eau.recuireChamp = () => { recuits++; return true }
  eau.recuireChampDiffere(3)
  lacsMemoEcrire(terrain.dem, [])
  eau.rebuild({ terrain, params: PARAMS, carre: { i0: 0, j0: 0, cote: 1 } }) // _clear() passe par là
  t.mock.timers.tick(5000)
  assert.equal(recuits, 0, 'un minuteur a survecu a la reconstruction')
})

// 🔴 UN LAC QUI ARRIVE APRÈS UN RECUIT NE DOIT PAS SE POSER SUR UNE TEXTURE
// DÉTRUITE. Le garde-fou de génération ne couvre que `_clear()` ; `recuireChamp`
// n'en fait pas, mais il DISPOSE l'ancienne texture. Le détecteur de lacs met
// ~600 ms au Worker, le recuit part à 300 ms : la fenêtre est grande ouverte.
// Un lac posé sur une texture détruite ne lève rien — il peint du noir.
test('un lac bati apres un recuit prend la texture VIVANTE', () => {
  const { eau, terrain } = batit({ carre: { i0: -1, j0: -1, cote: 3 }, fabriqueSol: () => () => -5 })
  const ancienne = eau._fieldTex
  eau.recuireChamp()
  const vivante = eau._fieldTex
  assert.notEqual(vivante, ancienne)
  // le retour tardif du Worker rappelle _batirLacs avec la texture CAPTURÉE
  const lac = { cells: new Int32Array([9, 10, 17, 18]), size: 8, elevM: 100 }
  eau._batirLacs([lac], { dem: terrain.dem, params: PARAMS, fieldTex: ancienne, cote: 1, centre: { x: 0, z: 0 } })
  const lacs = eau.materials.filter((m) => m.name === 'real-water-lake')
  for (const m of lacs) {
    assert.notEqual(m.uniforms.uField.value, ancienne, 'un lac pose sur la texture disposee : il peindra du noir')
    assert.equal(m.uniforms.uField.value, vivante)
  }
})

// ════ 4. L'ÉCHANTILLONNEUR SANS GRAIN — coordonnées LOCALES, pas monde ══════
//
// ⚠️ LA MUTATION QUE CE TEST EXISTE POUR TUER : interroger la voisine en
// coordonnées MONDE au lieu de locales. Le champ redevient faux sur les huit
// cases — le défaut même que l'échantillonneur existe pour supprimer — et en
// ronde 2 elle passait sur 182 tests.
function grilleBouchon(cellules) {
  const grille = Object.create(BlockGrid.prototype)
  grille.cells = new Map(cellules)
  return grille
}
// une cellule qui RAPPORTE les coordonnées qu'on lui a servies
const cellQuiNote = (journal) => ({
  terrain: { sampleChamp: () => (x, z) => { journal.push([x, z]); return 0 } },
})

test('les voisines sont interrogees en coordonnees LOCALES', () => {
  const journal = []
  const grille = grilleBouchon([['1,0', cellQuiNote(journal)], ['-1,-1', cellQuiNote(journal)]])
  const ech = grille.echantillonSansGrain({}, () => 42)
  ech(56, 0) // centre de la case (1,0)
  ech(60, 3) // 4 unités à l'est de son centre
  ech(-56, -56) // centre de la case (-1,-1)
  assert.deepEqual(journal, [[0, 0], [4, 3], [0, 0]], 'la voisine recoit des coordonnees MONDE')
})

test('le bloc central passe par l\'echantillonneur qu\'on lui donne', () => {
  const journal = []
  const grille = grilleBouchon([])
  const ech = grille.echantillonSansGrain({}, (x, z) => { journal.push([x, z]); return 7 })
  assert.equal(ech(3, -4), 7)
  assert.deepEqual(journal, [[3, -4]], 'le centre doit etre interroge en coordonnees monde')
})

test('une case pas encore arrivee retombe sur le bloc central', () => {
  const grille = grilleBouchon([])
  const ech = grille.echantillonSansGrain({}, () => 11)
  assert.equal(ech(112, 112), 11, 'une case absente devrait retomber sur le centre')
})

test('sans echantillonneur de centre, la fabrique se recuse', () => {
  assert.equal(grilleBouchon([]).echantillonSansGrain({}, null), null)
})

// La frontière entre cases : `Math.round(x / 56)` — un point à 28 unités bascule
// sur la case suivante, exactement comme `heightAt`. Vérifié pour que les deux
// ne divergent jamais (un objet posé au sol et le fond de la mer sous lui).
test('la frontiere entre cases est la MEME que celle de heightAt', () => {
  const journal = []
  const grille = grilleBouchon([['1,0', cellQuiNote(journal)]])
  const ech = grille.echantillonSansGrain({}, () => 0)
  ech(28, 0) // pile à la frontière : Math.round(0.5) = 1 → case (1,0), local -28
  assert.deepEqual(journal, [[-28, 0]])
})
