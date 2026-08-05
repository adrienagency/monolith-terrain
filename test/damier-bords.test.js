import test from 'node:test'
import assert from 'node:assert/strict'
import { readFileSync } from 'node:fs'
import { createHash } from 'node:crypto'
import { bordsExterieurs, masqueDepuisContour } from '../src/damier-bords.js'
import { computeSlab, buildSlabWalls } from '../src/plinth.js'
import { BlockGrid } from '../src/block-grid.js'

// convention d'axes de computeSlab : z=-HALF est le NORD, z=+HALF le SUD,
// x=+HALF l'EST, x=-HALF l'OUEST. j croît vers le sud (z croissant).
//
// `cellules` = les cases VOISINES posees. Le bloc central "0,0" n'y figure
// jamais (block-grid.js:178 le saute) mais existe toujours : bordsExterieurs
// doit le savoir sans qu'on le lui passe.
const damier3x3 = new Set(['-1,-1', '0,-1', '1,-1', '-1,0', '1,0', '-1,1', '0,1', '1,1'])
const seul = new Set()

test('une case isolee a ses quatre bords exterieurs', () => {
  assert.deepEqual(bordsExterieurs(0, 0, seul),
    { nord: true, est: true, sud: true, ouest: true })
})

test('la case du milieu d\'un 3x3 n\'a AUCUN bord exterieur', () => {
  assert.deepEqual(bordsExterieurs(0, 0, damier3x3),
    { nord: false, est: false, sud: false, ouest: false })
})

test('le coin nord-ouest d\'un 3x3 garde ses deux bords exposes', () => {
  assert.deepEqual(bordsExterieurs(-1, -1, damier3x3),
    { nord: true, est: false, sud: false, ouest: true })
})

test('le bord nord milieu n\'expose que le nord', () => {
  assert.deepEqual(bordsExterieurs(0, -1, damier3x3),
    { nord: true, est: false, sud: false, ouest: false })
})

test('le coin sud-est expose sud et est', () => {
  assert.deepEqual(bordsExterieurs(1, 1, damier3x3),
    { nord: false, est: true, sud: true, ouest: false })
})

// LE BLOC CENTRAL EXISTE TOUJOURS, même absent de l'ensemble des voisines.
// L'oublier donnerait un arrondi au bord d'une case collée au héros — une
// rainure en plein milieu du damier, le défaut exact des captures d'Adrien.
test('une voisine collee au bloc central ne s\'arrondit pas de ce cote', () => {
  const b = bordsExterieurs(1, 0, new Set(['1,0']))
  assert.equal(b.ouest, false, 'a l\'ouest il y a le bloc central')
  assert.equal(b.est, true)
  assert.equal(b.nord, true)
  assert.equal(b.sud, true)
})

// ⚠️ LE CAS QUE LE CARRÉ NE SAVAIT PAS TRAITER. Une zone isolée peut poser
// une figure TROUÉE (deux ilots opposes, block-grid.js:151-153). Deduire les
// bords d'un carre supposé plein declarerait ici l'arete interieure, le socle
// n'aurait pas de mur, et on verrait le jour sous la carte.
test('un damier troue expose les aretes qui n\'ont pas de voisine', () => {
  const troue = new Set(['-1,-1', '1,1']) // deux ilots en diagonale, rien entre
  const b = bordsExterieurs(-1, -1, troue)
  assert.deepEqual(b, { nord: true, est: true, sud: true, ouest: true },
    'aucune voisine adjacente : les quatre aretes restent exposees')
})

// LE MASQUE — c'est lui que le socle consomme, sommet par sommet. On le teste
// sur un VRAI contour rendu par computeSlab, pas sur un contour inventé : le
// but du module est justement de ne pas dupliquer le découpage de plinth.js.
const TOUS = { nord: true, est: true, sud: true, ouest: true }
const AUCUN = { nord: false, est: false, sud: false, ouest: false }
const platA10 = () => 10

function contourCarre(n = 32) {
  const slab = computeSlab(platA10, 7, n)
  const demi = Math.max(...slab.ring.map((p) => Math.abs(p.x)))
  return { ring: slab.ring, demi }
}

test('le masque d\'une case isolee vaut 1 partout', () => {
  const { ring, demi } = contourCarre()
  const m = masqueDepuisContour(ring, demi, TOUS)
  assert.equal(m.length, ring.length, 'un reel par sommet du contour')
  for (const v of m) assert.equal(v, 1)
})

test('le masque de la case centrale vaut 0 partout', () => {
  const { ring, demi } = contourCarre()
  for (const v of masqueDepuisContour(ring, demi, AUCUN)) assert.equal(v, 0)
})

// L'ÉTIQUETAGE SE FAIT PAR POSITION, pas par index. Un sommet du bord nord
// est celui dont z vaut -demi ; c'est vrai quel que soit l'ordre dans lequel
// computeSlab a tracé son contour, et ça le restera s'il change.
test('seuls les sommets du cote expose sont marques', () => {
  const { ring, demi } = contourCarre()
  const m = masqueDepuisContour(ring, demi, { nord: true, est: false, sud: false, ouest: false })
  let marques = 0
  for (let k = 0; k < ring.length; k++) {
    if (m[k] === 1) {
      assert.ok(ring[k].z <= -demi + 1e-3, `sommet ${k} marque alors qu'il n'est pas au nord`)
      marques++
    }
  }
  assert.ok(marques > 0, 'le cote nord doit bien etre marque')
})

// UN COIN N'EST ARRONDI QUE SI SES DEUX CÔTÉS LE SONT. Un quart de rond qui
// se termine à plat contre une jointure est pire que pas d'arrondi du tout.
test('un coin entre deux bords exterieurs reste arrondi', () => {
  const slab = computeSlab(platA10, 7, 32, 2.5) // cornerR > 0 : de vrais arcs
  const demi = Math.max(...slab.ring.map((p) => Math.abs(p.x)))
  const m = masqueDepuisContour(slab.ring, demi, { nord: true, est: true, sud: false, ouest: false })
  // un sommet d'arc du coin nord-est : x > 0, z < 0, sur aucun des deux bords droits
  const k = slab.ring.findIndex((p) => p.x > 0 && p.z < 0 && p.x < demi - 1e-3 && p.z > -demi + 1e-3)
  assert.ok(k >= 0, 'preambule : il existe bien un sommet d\'arc au nord-est')
  assert.equal(m[k], 1, 'nord et est exposes : le coin garde son arrondi')
})

test('un coin entre un bord exterieur et un interieur ne l\'est pas', () => {
  const slab = computeSlab(platA10, 7, 32, 2.5)
  const demi = Math.max(...slab.ring.map((p) => Math.abs(p.x)))
  const m = masqueDepuisContour(slab.ring, demi, { nord: true, est: false, sud: false, ouest: false })
  const k = slab.ring.findIndex((p) => p.x > 0 && p.z < 0 && p.x < demi - 1e-3 && p.z > -demi + 1e-3)
  assert.equal(m[k], 0, 'l\'est est interieur : le coin nord-est doit etre vif')
})

// ═══════════════ TÂCHE 5 : LE MASQUE ARRIVE JUSQU'À LA GÉOMÉTRIE ════════════
//
// Les tests ci-dessus vérifient le masque ; ceux-ci vérifient que le SOCLE le
// consomme — c'est là qu'était le défaut visible (« les arrondis sont vilains »).

const plat = (y) => () => y

// jusqu'où la géométrie va, sur un axe et dans un sens donnés
function extremeSur(pos, axe, signe) {
  let e = -Infinity
  for (let i = 0; i < pos.count; i++) {
    const v = axe === 'x' ? pos.getX(i) : pos.getZ(i)
    e = Math.max(e, signe * v)
  }
  return e
}
// … mais seulement parmi les sommets posés AU FOND du socle
function extremeAuFond(pos, axe, signe) {
  let fond = Infinity
  for (let i = 0; i < pos.count; i++) fond = Math.min(fond, pos.getY(i))
  let e = -Infinity
  for (let i = 0; i < pos.count; i++) {
    if (Math.abs(pos.getY(i) - fond) > 1e-6) continue
    const v = axe === 'x' ? pos.getX(i) : pos.getZ(i)
    e = Math.max(e, signe * v)
  }
  return e
}
// le contour que buildSlabWalls va tracer pour ces mêmes réglages
function contourDe(res, cornerR = 0, cornerExp = 2) {
  const slab = computeSlab(plat(10), 7, res, cornerR, cornerExp)
  return { ring: slab.ring, demi: Math.max(...slab.ring.map((p) => Math.abs(p.x))) }
}

test('sans masque, le socle garde ses arrondis sur les quatre cotes', () => {
  const pos = buildSlabWalls(plat(10), { resolution: 32 }).geo.getAttribute('position')
  const cotes = [['z', -1], ['z', 1], ['x', 1], ['x', -1]]
    .map(([a, s]) => extremeSur(pos, a, s) - extremeAuFond(pos, a, s))
  for (const r of cotes) assert.ok(r > 0.5, `un cote ne rentre que de ${r} : il a perdu son conge`)
  for (const r of cotes) assert.ok(Math.abs(r - cotes[0]) < 1e-6, 'symetrie preservee')
})

// LE CŒUR DE LA DEMANDE : « tous les arrondis directement adjacents d'une autre
// case sont retires pour avoir des jointures parfaites ».
test('un bord interieur perd son conge : le socle va jusqu\'au bord', () => {
  const { ring, demi } = contourDe(32)
  const masque = masqueDepuisContour(ring, demi, { nord: true, est: true, sud: false, ouest: true })
  const pos = buildSlabWalls(plat(10), { resolution: 32, masqueArrondi: masque }).geo.getAttribute('position')
  const rentree = extremeSur(pos, 'z', 1) - extremeAuFond(pos, 'z', 1)
  assert.ok(Math.abs(rentree) < 1e-3,
    `le fond rentre de ${rentree} au sud : le conge n'a pas ete supprime`)
})

test('un bord exterieur garde son conge quand son voisin l\'a perdu', () => {
  const { ring, demi } = contourDe(32)
  const masque = masqueDepuisContour(ring, demi, { nord: true, est: true, sud: false, ouest: true })
  const pos = buildSlabWalls(plat(10), { resolution: 32, masqueArrondi: masque }).geo.getAttribute('position')
  const rentree = extremeSur(pos, 'z', -1) - extremeAuFond(pos, 'z', -1)
  assert.ok(rentree > 0.5, `le nord, exterieur, doit garder son conge rentrant (${rentree})`)
})

// ⚠️ LE PIÈGE DU FOND. Avec des arrondis par sommet, un fond rentré d'une
// valeur UNIQUE ne rejoint plus le bas des murs : on voit sous le socle. Le
// test le mesure au lieu de le supposer — pour CHAQUE sommet du contour, le
// bas du mur et le bord du fond doivent être au même point.
test('le fond reste soude au bas des murs, arrondi ou pas', () => {
  const { ring, demi } = contourDe(32)
  const masque = masqueDepuisContour(ring, demi, { nord: true, est: false, sud: false, ouest: false })
  const geo = buildSlabWalls(plat(10), { resolution: 32, masqueArrondi: masque }).geo
  assert.equal(geo.getIndex(), null, 'geometrie non indexee, comme avant')
  const pos = geo.getAttribute('position')
  let fond = Infinity
  for (let i = 0; i < pos.count; i++) fond = Math.min(fond, pos.getY(i))
  // tous les sommets posés au fond, arrondis à 1e-4 : le bord du fond et le
  // pied du mur doivent tomber sur les MÊMES points, sinon il y a un jour
  const auFond = new Map()
  for (let i = 0; i < pos.count; i++) {
    if (Math.abs(pos.getY(i) - fond) > 1e-6) continue
    const cle = `${Math.round(pos.getX(i) * 1e4)},${Math.round(pos.getZ(i) * 1e4)}`
    auFond.set(cle, (auFond.get(cle) ?? 0) + 1)
  }
  // chaque point du bord du fond est partagé par le fond ET par le pied du
  // mur (ou du congé) : un point vu une seule fois est un bord libre
  const orphelins = [...auFond.values()].filter((c) => c < 2).length
  assert.equal(orphelins, 0, 'des sommets de fond sans mur en face : on voit sous le socle')
})

// et le même contrôle sur un socle SANS aucun masque : la référence
test('sans masque, le fond etait deja soude — la mesure est bien discriminante', () => {
  const pos = buildSlabWalls(plat(10), { resolution: 32 }).geo.getAttribute('position')
  let fond = Infinity
  for (let i = 0; i < pos.count; i++) fond = Math.min(fond, pos.getY(i))
  const auFond = new Map()
  for (let i = 0; i < pos.count; i++) {
    if (Math.abs(pos.getY(i) - fond) > 1e-6) continue
    const cle = `${Math.round(pos.getX(i) * 1e4)},${Math.round(pos.getZ(i) * 1e4)}`
    auFond.set(cle, (auFond.get(cle) ?? 0) + 1)
  }
  assert.equal([...auFond.values()].filter((c) => c < 2).length, 0)
})

// un masque tout à 1 doit rendre EXACTEMENT le socle sans masque : c'est la
// garantie que l'accesseur ne dérive pas d'un ulp au passage
test('un masque tout a 1 rend le socle d\'origine, au bit pres', () => {
  const { ring } = contourDe(24)
  const un = new Float32Array(ring.length).fill(1)
  const a = buildSlabWalls(plat(10), { resolution: 24 }).geo
  const b = buildSlabWalls(plat(10), { resolution: 24, masqueArrondi: un }).geo
  for (const nom of ['position', 'normal', 'uv', 'color']) {
    assert.deepEqual(Array.from(b.getAttribute(nom).array), Array.from(a.getAttribute(nom).array), nom)
  }
})

// ══════ LE CONTRAT : SANS MASQUE, LA GÉOMÉTRIE NE BOUGE PAS D'UN BIT ════════
//
// Le bloc isolé, le mode zone isolée et la fenêtre continue reposent tous sur
// buildSlabWalls sans masque. Les empreintes ci-dessous ont été relevées sur le
// code d'AVANT la Tâche 5 (position + normal + uv + color, octet par octet).
// Si l'une bouge, ce n'est pas une empreinte à rafraîchir : c'est que le socle
// par défaut a changé.
const vallonne = (x, z) => 6 * Math.sin(x * 0.21) + 4 * Math.cos(z * 0.13) - 2
function empreinte(geo) {
  const h = createHash('sha256')
  for (const nom of ['position', 'normal', 'uv', 'color']) {
    const a = geo.getAttribute(nom)
    h.update(nom)
    h.update(String(a.count))
    h.update(Buffer.from(a.array.buffer, a.array.byteOffset, a.array.byteLength))
  }
  return `${geo.getAttribute('position').count}:${h.digest('hex').slice(0, 32)}`
}
const EMPREINTES = [
  ['plat', plat(10), { resolution: 32 }, '4224:c2b4c869e1f7a15edef1df30b718494c'],
  ['vallonne', vallonne, { resolution: 24, depth: 5 }, '3744:3848a33a35a95bdf395df13ce1466d7a'],
  ['coin arrondi', vallonne, { resolution: 24, cornerR: 6, cornerExp: 3 }, '3744:75e757a3b866718756cbd2f68461ea98'],
  ['sans chanfrein', plat(3), { resolution: 16, chanfrein: 0 }, '1728:debba97ceeccd1355c557d115ecff295'],
  ['sans conge', plat(3), { resolution: 16, arrondi: 0 }, '1344:c343fd86aa5f71c1cb7bcb59f2d8c884'],
]
for (const [nom, sample, opts, attendue] of EMPREINTES) {
  test(`sans masque, le socle « ${nom} » est identique au code d'avant`, () => {
    assert.equal(empreinte(buildSlabWalls(sample, opts).geo), attendue)
  })
  test(`… et masqueArrondi: null ne change rien non plus (« ${nom} »)`, () => {
    assert.equal(empreinte(buildSlabWalls(sample, { ...opts, masqueArrondi: null }).geo), attendue)
  })
}

// ══════ LE RACCOURCI `bords` — MÊME RÉSULTAT, SANS RETRACER LE CONTOUR ══════
//
// ⚠️ DIVERGENCE ASSUMÉE AVEC LE BRIEF (voir le rapport de tâche). Le brief fait
// calculer le masque chez l'APPELANT, ce qui l'oblige à retracer le contour —
// un second computeSlab par mur, soit ~9,4 ms de plus à chaque reconstruction,
// et jusqu'à 36 par damier. `bords` laisse buildSlabWalls dériver le masque de
// SON PROPRE contour : coût nul, et aucun risque de masque désynchronisé.
test('l\'option `bords` rend le meme socle que le masque calcule dehors', () => {
  const bords = { nord: true, est: false, sud: false, ouest: true }
  const { ring, demi } = contourDe(24, 3)
  const parMasque = buildSlabWalls(plat(10), {
    resolution: 24, cornerR: 3, masqueArrondi: masqueDepuisContour(ring, demi, bords),
  }).geo
  const parBords = buildSlabWalls(plat(10), { resolution: 24, cornerR: 3, bords }).geo
  const nu = buildSlabWalls(plat(10), { resolution: 24, cornerR: 3 }).geo
  assert.notDeepEqual(
    Array.from(parBords.getAttribute('position').array),
    Array.from(nu.getAttribute('position').array),
    'preambule : deux cotes interieurs DOIVENT changer la geometrie')
  assert.deepEqual(
    Array.from(parBords.getAttribute('position').array),
    Array.from(parMasque.getAttribute('position').array))
})

test('`bords` : quatre cotes exterieurs = le socle d\'origine, au bit pres', () => {
  const geo = buildSlabWalls(plat(10), { resolution: 32, bords: { nord: true, est: true, sud: true, ouest: true } }).geo
  assert.equal(empreinte(geo), '4224:c2b4c869e1f7a15edef1df30b718494c')
})

// ═══════════════ LE CHEMIN JUSQU'AU DAMIER, ET JUSQU'AU HÉROS ═══════════════

function damierBouchon(centre = -10) {
  const present = new Set()
  const scene = { add: (o) => present.add(o), remove: (o) => present.delete(o) }
  const g = new BlockGrid({
    scene,
    params: {},
    getMainDem: () => null,
    getMainTerrain: () => null,
    getPlinth: () => ({ baseY: centre, depth: 7, wallMat: { dispose: () => {} } }),
  })
  return g
}
// ⚠️ cornerR = 0 (empreinte CARRÉE) parce que la mesure ci-dessous lit
// l'extrême d'un axe : dès qu'un coin est filetté, le dernier sommet du côté
// NORD porte encore le x maximal, et sa rentrée à lui se fait en z. Le congé de
// l'est serait alors mesuré à 0,05 au lieu de 1,06 — un faux négatif, pas un
// défaut. Le filetage des coins est vérifié à part (masqueDepuisContour).
function celluleBouchon(i, j, y) {
  return { i, j, terrain: { sample: () => y }, baseYPropre: y - 7, planchierPose: null,
    _paramsMurs: { resolution: 16, cornerR: 0, cornerExp: 2 } }
}

test('une voisine collee au heros n\'arrondit pas ce cote-la', () => {
  const g = damierBouchon()
  const a = celluleBouchon(1, 0, -5) // a l'OUEST il y a le bloc central
  g.cells.set('1,0', a)
  g.egaliseHauteurs()
  const pos = a.walls.geometry.getAttribute('position')
  const ouest = extremeSur(pos, 'x', -1) - extremeAuFond(pos, 'x', -1)
  const est = extremeSur(pos, 'x', 1) - extremeAuFond(pos, 'x', 1)
  assert.ok(Math.abs(ouest) < 1e-3, `le cote colle au heros rentre encore de ${ouest}`)
  assert.ok(est > 0.5, `l'est est expose : il doit garder son conge (${est})`)
})

// ⚠️ UNE ARRIVÉE CHANGE LES BORDS DES CASES DÉJÀ POSÉES. Sans ça, la voisine
// d'à côté garde l'arrondi qu'elle avait quand elle était au bord du damier —
// et la rainure réapparaît à la jointure neuve.
test('l\'arrivee d\'une voisine re-coule les murs de celle qu\'elle touche', () => {
  const g = damierBouchon()
  const a = celluleBouchon(1, 0, -5)
  g.cells.set('1,0', a)
  assert.equal(g.egaliseHauteurs(), 1)
  const avant = a.walls.geometry
  // MÊME profondeur : le plancher commun ne bouge pas. Seuls les bords changent.
  g.cells.set('2,0', celluleBouchon(2, 0, -5))
  assert.equal(g.egaliseHauteurs(), 2, 'la nouvelle ET sa voisine doivent etre refaites')
  assert.notEqual(a.walls.geometry, avant, 'a porte une nouvelle geometrie')
  const pos = a.walls.geometry.getAttribute('position')
  const est = extremeSur(pos, 'x', 1) - extremeAuFond(pos, 'x', 1)
  assert.ok(Math.abs(est) < 1e-3, `a touche maintenant (2,0) a l'est : ${est} de rentree de trop`)
})

test('rien ne change, rien n\'est refait : l\'egalisation reste idempotente', () => {
  const g = damierBouchon()
  g.cells.set('1,0', celluleBouchon(1, 0, -5))
  g.egaliseHauteurs()
  assert.equal(g.egaliseHauteurs(), 0, 'un second passage ne doit rien recouler')
})

// LE BLOC CENTRAL AUSSI. C'est le défaut le plus visible des captures : le
// héros gardait ses quatre arrondis AU MILIEU du damier.
test('bordsHero() rend les aretes encore exposees du bloc central', () => {
  const g = damierBouchon()
  assert.deepEqual(g.bordsHero(), { nord: true, est: true, sud: true, ouest: true })
  g.cells.set('1,0', celluleBouchon(1, 0, -5))
  assert.deepEqual(g.bordsHero(), { nord: true, est: false, sud: true, ouest: true })
  for (const [k, c] of [['0,-1', [0, -1]], ['0,1', [0, 1]], ['-1,0', [-1, 0]]]) {
    g.cells.set(k, celluleBouchon(c[0], c[1], -5))
  }
  assert.deepEqual(g.bordsHero(), { nord: false, est: false, sud: false, ouest: false })
})

// Le masque du héros passe par main.js (c'est lui qui tient `terrain`, `params`
// et le plancher de fenêtre continue). Impossible d'importer main.js ici — on
// relit le câblage, comme test/mer-emprise.test.js relit ocean.js.
test('main.js recale le socle du heros quand le damier change', () => {
  const src = readFileSync(new URL('../src/main.js', import.meta.url), 'utf8')
  assert.match(src, /plinth\.bordsHero\s*=/, 'main.js doit poser plinth.bordsHero')
  assert.match(src, /blockGrid\.bordsHero\(\)/, 'et le lire sur le damier')
  const m = src.match(/function majBordsHero\(\)\s*\{[\s\S]*?\n\}/)
  assert.ok(m, 'majBordsHero() introuvable')
  assert.match(m[0], /plinth\.rebuild\(terrain, params, socleEmprise\(\)\)/,
    'le socle central doit etre re-coule, sinon le masque ne sert a rien')
  assert.match(src, /onGridChanged = \(\) =>[\s\S]{0,160}majBordsHero\(\)/,
    'et ce recalage doit etre branche sur onGridChanged')
})

test('Plinth.rebuild passe son bordsHero a buildSlabWalls', () => {
  const src = readFileSync(new URL('../src/plinth.js', import.meta.url), 'utf8')
  const m = src.match(/rebuild\(terrain, params, baseYFloor = null\)\s*\{[\s\S]*?\n  \}/)
  assert.ok(m, 'Plinth.rebuild introuvable')
  assert.match(m[0], /bords: this\.bordsHero/, 'le socle du heros doit recevoir ses bords')
})
