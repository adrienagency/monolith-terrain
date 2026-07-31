import test from 'node:test'
import assert from 'node:assert/strict'
import { EMPRISE_COTE, originesEmprise, recollerEmprise } from '../src/dem-emprise.js'

// Un faux bloc de MNT : la forme exacte que rend `loadDem` (dem.js:519), réduit
// aux clés dont le recollage a besoin.
const bloc = (over = {}) => ({
  data: new Int16Array(4 * 4),
  size: 4,
  tilePx: 512,
  demSource: 'mapterhorn',
  metersPerPixel: 30,
  extentMeters: 120,
  minM: 0,
  maxM: 10,
  meanM: 5,
  lat: 45,
  lon: 6,
  zoom: 12,
  originTileX: 100,
  originTileY: 200,
  ...over,
})

// Neuf blocs en ligne-major, chacun rempli d'une valeur constante = son rang.
// Un damier de constantes est le seul motif où une erreur de rangement se voit
// à coup sûr : une transposition, un décalage d'une ligne, une inversion des
// axes donnent tous une image différente.
function neufBlocs(cote = 4) {
  return Array.from({ length: 9 }, (_, k) => {
    const d = new Int16Array(cote * cote).fill(k)
    return bloc({
      data: d,
      size: cote,
      originTileX: 100 + (k % 3) * 3,
      originTileY: 200 + ((k / 3) | 0) * 3,
      minM: k,
      maxM: k,
      meanM: k,
    })
  })
}

// ── LES ORIGINES ─────────────────────────────────────────────────────────────

test('les neuf origines encadrent le bloc central, en ligne-major', () => {
  const o = originesEmprise({ originTileX: 100, originTileY: 200 }, 3)
  assert.equal(o.length, 9)
  assert.deepEqual(o[0], { x: 97, y: 197 }, 'le premier est le coin haut-gauche')
  assert.deepEqual(o[4], { x: 100, y: 200 }, 'le cinquième est le bloc central lui-même')
  assert.deepEqual(o[8], { x: 103, y: 203 }, 'le dernier est le coin bas-droit')
})

test('les origines avancent de tilesAcross, pas de 1', () => {
  // Une dalle voisine commence là où la précédente finit. Un pas de 1 ferait se
  // chevaucher les neuf dalles à 2/3 et le relief se répéterait.
  const o = originesEmprise({ originTileX: 0, originTileY: 0 }, 3)
  assert.equal(o[1].x - o[0].x, 3)
  assert.equal(o[3].y - o[0].y, 3)
})

// ── LE RECOLLAGE ─────────────────────────────────────────────────────────────

test('le champ recollé fait trois fois le côté d’un bloc', () => {
  const e = recollerEmprise(neufBlocs(4))
  assert.equal(e.size, 12)
  assert.equal(e.data.length, 144)
  assert.ok(e.data instanceof Int16Array, 'reste en Int16 — le levier mémoire du jalon 0')
})

test('chaque bloc atterrit à SA place, et pas à celle du voisin', () => {
  const e = recollerEmprise(neufBlocs(4))
  const at = (x, y) => e.data[y * 12 + x]
  // un point au cœur de chacune des neuf zones
  for (let by = 0; by < 3; by++) {
    for (let bx = 0; bx < 3; bx++) {
      const attendu = by * 3 + bx
      assert.equal(at(bx * 4 + 2, by * 4 + 2), attendu, `zone (${bx},${by})`)
    }
  }
})

test('le bloc CENTRAL occupe bien le tiers central', () => {
  // C'est l'invariant qui garantit qu'entrer en mode continu ne DÉPLACE rien :
  // à décalage nul, la fenêtre doit lire exactement ce qu'elle lisait avant.
  const e = recollerEmprise(neufBlocs(6))
  for (let y = 6; y < 12; y++) for (let x = 6; x < 12; x++) assert.equal(e.data[y * 18 + x], 4)
})

test('l’axe des lignes est bien +z (ligne-major), comme sampleDem le lit', () => {
  // sampleDem indexe `y0 * size + x0` avec y ↔ monde +z. Une transposition ici
  // ferait défiler le terrain à 90° du geste — visible tout de suite, mais
  // impossible à diagnostiquer sans ce test.
  const b = neufBlocs(2)
  b[1].data.fill(77) // colonne 1, ligne 0 → à droite du coin haut-gauche
  const e = recollerEmprise(b)
  assert.equal(e.data[0 * 6 + 2], 77, 'le bloc 1 est à DROITE, pas en dessous')
  assert.equal(e.data[2 * 6 + 0], 3, 'le bloc 3 est EN DESSOUS')
})

// ── LES STATISTIQUES GLOBALES — le piège n° 1 de l'étude ─────────────────────

test('uHeightRange : les extrema portent sur l’emprise ENTIÈRE', () => {
  // ⚠️ LE PIÈGE. Une voisine plus haute que le centre ferait saturer les
  // sommets si l'échelle restait celle du centre — le sommet du voisin
  // dépasserait le haut de la rampe et se peindrait d'une seule couleur.
  const b = neufBlocs(4)
  b[4].minM = 100
  b[4].maxM = 200 // le centre
  b[7].maxM = 3000 // une voisine BIEN plus haute
  b[1].minM = -50 // une autre bien plus basse
  const e = recollerEmprise(b)
  assert.equal(e.maxM, 3000, 'le max est celui de l’emprise, pas du centre')
  assert.equal(e.minM, -50, 'le min aussi')
})

test('meanM reste celui du CENTRE — c’est le zéro vertical', () => {
  // meanM ne normalise rien : il cale la verticale. Le prendre sur l'emprise
  // ferait SAUTER le terrain au moment d'entrer en mode continu, alors que
  // l'image doit être identique à décalage nul.
  const b = neufBlocs(4)
  b[4].meanM = 1234
  assert.equal(recollerEmprise(b).meanM, 1234)
})

test('l’emprise couvre trois fois l’étendue au sol, à résolution constante', () => {
  const e = recollerEmprise(neufBlocs(4))
  assert.equal(e.extentMeters, 360, '3 × 120')
  assert.equal(e.metersPerPixel, 30, 'la résolution ne change pas — on colle, on ne rééchantillonne pas')
})

test('le géoréférencement est celui du coin HAUT-GAUCHE', () => {
  // C'est ce que lit geo.js pour convertir lat/lon ↔ XZ. Laisser l'origine du
  // centre décalerait tous les tracés GPX d'une largeur de bloc.
  const e = recollerEmprise(neufBlocs(4))
  assert.equal(e.originTileX, 100)
  assert.equal(e.originTileY, 200)
})

test('le centre géographique de l’emprise est celui du bloc central', () => {
  const b = neufBlocs(4)
  b[4].lat = -21.13
  b[4].lon = 55.53
  const e = recollerEmprise(b)
  assert.equal(e.lat, -21.13)
  assert.equal(e.lon, 55.53)
  assert.equal(e.zoom, 12)
})

// ── LES REFUS ────────────────────────────────────────────────────────────────

test('un bloc manquant fait échouer le recollage, il ne fabrique pas un trou', () => {
  // Un trou dans l'emprise se lirait comme une plaine au niveau de la mer au
  // milieu des Alpes : une PANNE déguisée en relief. Mieux vaut ne pas entrer
  // en mode continu que de montrer ça.
  const b = neufBlocs(4)
  b[6] = null
  assert.throws(() => recollerEmprise(b), /manquant/i)
})

test('des blocs de tailles différentes sont refusés', () => {
  const b = neufBlocs(4)
  b[2] = bloc({ data: new Int16Array(64), size: 8 })
  assert.throws(() => recollerEmprise(b), /taille/i)
})

test('des blocs de zooms différents sont refusés', () => {
  const b = neufBlocs(4)
  b[5].zoom = 11
  assert.throws(() => recollerEmprise(b), /zoom|résolution/i)
})

test('il en faut neuf, pas huit', () => {
  assert.throws(() => recollerEmprise(neufBlocs(4).slice(0, 8)), /neuf|9/i)
})

test('EMPRISE_COTE vaut 3 — le 3×3 borné qu’Adrien a fixé', () => {
  assert.equal(EMPRISE_COTE, 3)
})
