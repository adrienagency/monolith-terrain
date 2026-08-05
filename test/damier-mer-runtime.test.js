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

// ⚠️ CE TEST A ÉTÉ REFAIT EN RONDE 3. Il s'appelait « un echantillonneur fige
// rendrait le recuit inutile » et SURVIVAIT à la mutation qu'il nommait : son
// « échantillonneur figé » était une fermeture qui relisait une variable
// mutable, donc pas figé du tout. C'était de surcroît un quasi-doublon du test
// précédent. Il vérifie maintenant le seul comportement que l'autre ne couvre
// pas, et que le contrat « FABRIQUE, pas échantillonneur » porte tout entier :
// la fabrique est RAPPELÉE à chaque cuisson. Capturée une fois, elle ne verrait
// jamais les dalles arrivées depuis — le recuit tournerait, et pour rien.
test('la fabrique est rappelee a CHAQUE cuisson, jamais capturee une fois', () => {
  let appels = 0
  const fabriqueSol = () => { appels++; return () => -5 }
  const { eau } = batit({ carre: { i0: -1, j0: -1, cote: 3 }, fabriqueSol })
  assert.equal(appels, 1, 'la reconstruction doit fabriquer son echantillonneur')
  eau.recuireChamp()
  assert.equal(appels, 2, 'le recuit reutilise un echantillonneur perime')
  eau.recuireChamp()
  assert.equal(appels, 3)
})

// 🔴 CHAQUE RECUIT DOIT LAISSER `_textures` COHÉRENT, sinon la mer FUIT.
// `_clear()` ne dispose que ce que `_textures` contient : une texture de champ
// remplacée mais laissée hors du tableau ne serait jamais libérée — 5,3 Mio de
// demi-flottantes par recuit sur un 3×3, jusqu'à huit recuits sur un 5×5, soit
// une quarantaine de mégaoctets perdus par session. Le tableau ne doit ni
// grandir (l'ancienne est REMPLACÉE, pas ajoutée), ni oublier la nouvelle, ni
// retenir l'ancienne, qui vient d'être disposée.
test('un recuit remplace la texture dans _textures, sans en abandonner aucune', () => {
  const { eau } = batit({ carre: { i0: -1, j0: -1, cote: 3 }, fabriqueSol: () => () => -5 })
  const avant = eau._fieldTex
  const nb = eau._textures.length
  assert.ok(eau._textures.includes(avant), 'le champ de depart n\'est pas suivi')

  eau.recuireChamp()
  const apres = eau._fieldTex
  assert.notEqual(apres, avant)
  assert.ok(eau._textures.includes(apres), 'la texture recuite ne sera JAMAIS disposee : elle fuit')
  assert.ok(!eau._textures.includes(avant), 'la texture disposee est encore suivie')
  assert.equal(eau._textures.length, nb, 'le suivi des textures enfle a chaque recuit')

  // … et trois recuits de plus ne font toujours pas enfler le tableau
  for (let i = 0; i < 3; i++) eau.recuireChamp()
  assert.equal(eau._textures.length, nb)
  assert.ok(eau._textures.includes(eau._fieldTex))
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

// ⚠️ ET LE DÉLAI LUI-MÊME EST UNE VALEUR, PAS UN RÉGLAGE DE CONFORT. `ocean.js`
// l'écrit ; sans ce test la phrase était creuse — le porter de 300 ms à 3 s ne
// faisait rougir personne, et c'est trois secondes de mer fausse après la
// dernière dalle, en silence. Les bornes disent les deux exigences en même
// temps : assez LONG pour fondre une rafale d'arrivées (rien n'est parti à
// 299 ms), assez COURT pour que la mer se corrige avant que l'œil ne s'y pose
// (tout est parti à 400 ms).
test('l\'amortissement du recuit tient dans une demi-seconde', (t) => {
  t.mock.timers.enable({ apis: ['setTimeout'] })
  let recuits = 0
  const { eau } = batit({ carre: { i0: -1, j0: -1, cote: 3 }, fabriqueSol: () => () => -5 })
  eau.recuireChamp = () => { recuits++; return true }
  eau.recuireChampDiffere(3)
  t.mock.timers.tick(299)
  assert.equal(recuits, 0, 'le recuit part trop tot : une rafale d\'arrivees ne fondra pas')
  t.mock.timers.tick(101) // 400 ms au total
  assert.equal(recuits, 1, 'le recuit tarde : autant de mer fausse apres la derniere dalle')
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
// Une cellule qui RAPPORTE les coordonnées qu'on lui a servies, par les DEUX
// chemins : `sampleChamp` (celui de la mer) et `sample` (celui de `heightAt`,
// qui pose les objets au sol).
const cellQuiNote = (journal, journalSol = journal) => ({
  terrain: {
    sampleChamp: () => (x, z) => { journal.push([x, z]); return 0 },
    sample: (x, z) => { journalSol.push([x, z]); return 0 },
  },
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

// ⚠️ CE TEST A ÉTÉ REFAIT EN RONDE 3 : son titre annonçait une comparaison avec
// `heightAt` et il ne l'appelait JAMAIS — il comparait à une paire écrite en dur.
// Conséquence relevée par la revue : `heightAt` n'était exécuté par aucun test du
// dépôt, et une mutation de son `Math.round` en `Math.floor` ne tuait rien.
//
// L'assertion est maintenant CROISÉE, et c'est bien la propriété qui compte : le
// fond de la mer sous un point et l'objet posé au sol en ce même point doivent
// venir de la MÊME case. Une divergence de découpage ferait flotter les bateaux
// à une jointure sur deux, sans que rien ne le signale.
test('la frontiere entre cases est la MEME que celle de heightAt', () => {
  const SONDES = [
    [28, 0], // pile à la frontière : Math.round(0.5) = 1 → case (1,0)
    [27.9, 0], // juste avant : encore le bloc central
    [-28, 0], // la frontière opposée : Math.round(-0.5) = -0 → case (0,0) en JS
    [84, 56], // deux cases plus loin, en diagonale
    [-83, -29],
  ]
  const journalMer = []
  const journalSol = []
  const cellules = []
  for (let j = -2; j <= 2; j++) {
    for (let i = -2; i <= 2; i++) {
      if (i === 0 && j === 0) continue // heightAt rend null au centre : il n'est pas au damier
      cellules.push([`${i},${j}`, cellQuiNote(journalMer, journalSol)])
    }
  }
  const grille = grilleBouchon(cellules)
  const ech = grille.echantillonSansGrain({}, () => 0)

  for (const [x, z] of SONDES) {
    const h = grille.heightAt(x, z) // ← le VRAI heightAt, celui qui pose les objets au sol
    if (h === null) journalSol.push(null) // bloc central : il appartient à `terrain`
    ech(x, z)
  }
  // la mer note aussi `null` pour le centre, par construction de sa fabrique :
  // on le rejoue ici pour que les deux journaux se comparent point à point.
  const merNormalise = []
  let k = 0
  for (const [x, z] of SONDES) {
    const i = Math.round(x / TERRAIN_SIZE)
    const j = Math.round(z / TERRAIN_SIZE)
    merNormalise.push(i === 0 && j === 0 ? null : journalMer[k++])
  }
  assert.deepEqual(merNormalise, journalSol, 'la mer et heightAt ne decoupent pas le damier pareil')
  // … et le découpage attendu, écrit une fois, pour que les deux puissent être
  // fausses ENSEMBLE sans passer.
  assert.deepEqual(journalSol, [[-28, 0], null, null, [-28, 0], [-27, 27]])
})
