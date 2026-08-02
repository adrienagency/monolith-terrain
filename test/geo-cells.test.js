import { test } from 'node:test'
import assert from 'node:assert/strict'
import {
  CELL_SIZES,
  cellIndex,
  cellKey,
  cellsForBounds,
  cellPath,
  mergeCells,
  emptyPayload,
  hasCell,
  buildBits,
  MAX_CELLS,
} from '../src/map/geo-cells.js'

// ------------------------------------------------------------- indexation

test('cellIndex place le coin sud-ouest du monde en 0/0', () => {
  assert.deepEqual(cellIndex(2, -90, -180), { row: 0, col: 0 })
})

test('cellIndex : Annecy (45.9N 6.1E) tombe dans la cellule attendue a 2 degres', () => {
  // row = floor((45.9+90)/2) = 67 ; col = floor((6.1+180)/2) = 93
  assert.deepEqual(cellIndex(2, 45.9, 6.1), { row: 67, col: 93 })
})

test('cellIndex : le pole nord exact est rabattu sur la derniere rangee', () => {
  // sinon floor((90+90)/2) = 90 sortirait de la grille (0..89)
  assert.deepEqual(cellIndex(2, 90, 0), { row: 89, col: 90 })
})

test('cellIndex : lon = +180 revient a la colonne 0 (meme meridien que -180)', () => {
  assert.deepEqual(cellIndex(2, 0, 180), cellIndex(2, 0, -180))
})

test('cellIndex : une longitude qui deborde (+185, -190) est repliee sur le tore', () => {
  assert.deepEqual(cellIndex(2, 0, 185), cellIndex(2, 0, -175))
  assert.deepEqual(cellIndex(2, 0, -190), cellIndex(2, 0, 170))
})

test('cellKey formate rangee_colonne', () => {
  assert.equal(cellKey(2, 45.9, 6.1), '67_93')
})

test('cellPath imbrique par rangee pour ne pas entasser 3000 fichiers dans un dossier', () => {
  assert.equal(cellPath('places', '67_93'), 'data/map/cells/places/67/93.json')
})

// --------------------------------------------------- selection par emprise

const B = (minLat, maxLat, minLon, maxLon) => ({ minLat, maxLat, minLon, maxLon })

test('une emprise de bloc typique (Annecy, 0.3 degre) tient en 1 a 4 cellules', () => {
  // l emprise reelle franchit la frontiere 46 deg : deux cellules, pas une.
  assert.deepEqual(cellsForBounds(B(45.77, 46.03, 6.0, 6.28), 2).sort(), ['67_93', '68_93'])
})

test('une emprise entierement interieure a une cellule n en demande qu une', () => {
  assert.deepEqual(cellsForBounds(B(45.2, 45.5, 6.0, 6.28), 2), ['67_93'])
})

test('une emprise a cheval sur deux cellules en demande deux', () => {
  const keys = cellsForBounds(B(45.9, 46.1, 6.1, 6.2), 2)
  assert.deepEqual(keys.sort(), ['67_93', '68_93'])
})

test('une emprise a cheval sur un coin en demande quatre', () => {
  const keys = cellsForBounds(B(45.9, 46.1, 5.9, 6.1), 2)
  assert.deepEqual(keys.sort(), ['67_92', '67_93', '68_92', '68_93'])
})

test('aucun doublon quand l emprise est plus petite qu une cellule', () => {
  const keys = cellsForBounds(B(45.8, 45.81, 6.0, 6.01), 10)
  assert.equal(keys.length, 1)
  assert.equal(new Set(keys).size, 1)
})

// ------------------------------------------------ le piege de l antimeridien

// ⚠️ CE TEST A CHANGE DE PREMISSE LE 2026-08-02, ET C'EST LE FOND DU SUJET.
//
// Il verrouillait la forme TRIEE (minLon=-179.9, maxLon=179.8) que `patchBounds`
// produisait avant sa correction, et l'heuristique « plus de 180 degres = un
// enroulement » qui servait a la rattraper. Les deux sont partis ensemble :
// `patchBounds` rend desormais l'ouest puis l'est sans trier, et une etendue de
// plus de 180 degres est redevenue ce qu'elle dit — MESURE, une emprise 3x3 fait
// 202,5 degres a z4 et 405 a z3, et l'heuristique les retournait en leur
// complement.
//
// La PROPRIETE protegee, elle, n'a pas bouge d'un pouce : un bloc etroit a
// cheval sur la ligne de changement de date ne doit pas demander le monde. Seule
// l'ecriture de l'emprise a change — c'est maintenant celle de `tilesForBBox`.
test('ANTIMERIDIEN : un bloc etroit a cheval sur +/-180 (ouest 179.8, est -179.9) ne demande PAS le monde', () => {
  const keys = cellsForBounds(B(-17.0, -16.7, 179.8, -179.9), 2)
  assert.ok(keys.length <= 4, `attendu <= 4 cellules, recu ${keys.length}`)
  // les colonnes retenues doivent encadrer la ligne : 179 (le bout est) et 0 (le bout ouest)
  const cols = new Set(keys.map((k) => Number(k.split('_')[1])))
  assert.ok(cols.has(179) && cols.has(0), `colonnes ${[...cols]}`)
})

test('UNE LARGE EMPRISE N EST PLUS PRISE POUR UN ENROULEMENT — le 3x3 au plancher', () => {
  // MESURE : une emprise 3x3 fait NEUF tuiles de large, donc 202,5 degres a z4.
  // L'heuristique des 180 degres en prenait le COMPLEMENT (157,5 degres a
  // l'oppose du globe) et rendait des cellules de l'autre bout de la Terre.
  // On demande ici l'Europe elargie : les colonnes doivent encadrer Greenwich,
  // pas le Pacifique.
  const keys = cellsForBounds(B(30, 50, -101.25, 101.25), 10)
  if (keys === null) return // plafonne par MAX_CELLS : c'est un refus honnete
  const cols = new Set(keys.map((k) => Number(k.split('_')[1])))
  assert.ok(cols.has(18), 'la colonne de Greenwich (lon 0) doit etre dedans')
  assert.ok(!cols.has(0), "la colonne de -180 n'a rien a faire dans une emprise centree sur l'Europe")
})

test('ANTIMERIDIEN : la forme explicitement enroulee (minLon > maxLon) est comprise', () => {
  const keys = cellsForBounds(B(0, 0.5, 179.5, -179.5), 2)
  const cols = new Set(keys.map((k) => Number(k.split('_')[1])))
  assert.ok(keys.length <= 4, `attendu <= 4 cellules, recu ${keys.length}`)
  assert.ok(cols.has(179) && cols.has(0))
})

test('ANTIMERIDIEN : les longitudes debordantes (+180.4) produisent des colonnes valides', () => {
  const keys = cellsForBounds(B(0, 0.5, 179.6, 180.4), 2)
  for (const k of keys) {
    const col = Number(k.split('_')[1])
    assert.ok(col >= 0 && col < 180, `colonne hors grille : ${col}`)
  }
})

test('une emprise reellement mondiale est plafonnee a MAX_CELLS (garde-fou)', () => {
  const keys = cellsForBounds(B(-85, 85, -180, 180), 2)
  assert.equal(keys, null, 'au-dela du plafond on rend null pour basculer sur le fichier monolithe')
})

test('les latitudes hors bornes sont serrees sans sortir de la grille', () => {
  const keys = cellsForBounds(B(-95, -89.5, 0, 0.5), 10)
  for (const k of keys) {
    const row = Number(k.split('_')[0])
    assert.ok(row >= 0 && row < 18, `rangee hors grille : ${row}`)
  }
})

test('MAX_CELLS est un plafond raisonnable', () => {
  assert.ok(MAX_CELLS >= 16 && MAX_CELLS <= 256)
})

// -------------------------------------------------------------- fusion

test('mergeCells(places) concatene et RETRIE par population decroissante', () => {
  // pickPlaces exige des lignes triees par proeminence : concatener deux
  // cellules casserait ce tri si on ne retriait pas.
  const a = [['B', 1, 1, 500, 0, 8], ['D', 1, 1, 100, 0, 8]]
  const b = [['A', 2, 2, 900, 0, 8], ['C', 2, 2, 300, 0, 8]]
  assert.deepEqual(mergeCells('places', [a, b]).map((r) => r[0]), ['A', 'B', 'C', 'D'])
})

test('mergeCells(places) sur zero cellule rend un tableau vide, jamais null', () => {
  assert.deepEqual(mergeCells('places', []), [])
})

test('mergeCells(places) ignore les cellules manquantes (404) sans casser', () => {
  const a = [['A', 1, 1, 9, 0, 8]]
  assert.deepEqual(mergeCells('places', [null, a, undefined]).length, 1)
})

const feat = (id, coords) => ({
  type: 'Feature',
  properties: id == null ? { name: 'x' } : { name: 'x', fid: id },
  geometry: { type: 'LineString', coordinates: coords },
})
const fc = (features) => ({ type: 'FeatureCollection', features })

test('mergeCells(vecteur) concatene les features de plusieurs cellules', () => {
  const out = mergeCells('rivers', [fc([feat(null, [[0, 0]])]), fc([feat(null, [[1, 1]])])])
  assert.equal(out.type, 'FeatureCollection')
  assert.equal(out.features.length, 2)
})

test('mergeCells(vecteur) DEDOUBLONNE les features copiees entieres (fid) aux frontieres', () => {
  // un lac a cheval sur deux cellules est copie tel quel dans chacune : sans
  // dedoublonnage on le dessinerait deux fois (double remplissage, z-fighting)
  const out = mergeCells('lakes', [fc([feat(7, [[0, 0]])]), fc([feat(7, [[0, 0]]), feat(8, [[2, 2]])])])
  assert.deepEqual(out.features.map((f) => f.properties.fid), [7, 8])
})

test('mergeCells(vecteur) ne dedoublonne PAS les morceaux de lignes decoupees (pas de fid)', () => {
  // une riviere coupee en deux troncons partage ses proprietes mais chaque
  // troncon porte une geometrie differente : les jeter serait un trou visible
  const out = mergeCells('rivers', [fc([feat(null, [[0, 0], [1, 1]])]), fc([feat(null, [[1, 1], [2, 2]])])])
  assert.equal(out.features.length, 2)
})

test('mergeCells(vecteur) sur zero cellule rend une FeatureCollection vide, jamais null', () => {
  assert.deepEqual(mergeCells('lakes', []), { type: 'FeatureCollection', features: [] })
})

test('mergeCells tolere une cellule au contenu inattendu', () => {
  assert.deepEqual(mergeCells('lakes', [{ nawak: 1 }, null, 42]).features, [])
  assert.deepEqual(mergeCells('places', [{ nawak: 1 }]), [])
})

test('emptyPayload suit le type de la couche', () => {
  assert.deepEqual(emptyPayload('places'), [])
  assert.deepEqual(emptyPayload('lakes'), { type: 'FeatureCollection', features: [] })
})

// ------------------------------------------------------- manifeste binaire

test('buildBits / hasCell font l aller-retour sur un jeu de cles', () => {
  const bits = buildBits(2, ['67_93', '0_0', '89_179'])
  const man = { layers: { places: { size: 2, bits } } }
  assert.equal(hasCell(man, 'places', '67_93'), true)
  assert.equal(hasCell(man, 'places', '0_0'), true)
  assert.equal(hasCell(man, 'places', '89_179'), true)
  assert.equal(hasCell(man, 'places', '40_40'), false)
})

test('hasCell rend true (optimiste) quand le manifeste est absent ou incomplet', () => {
  // ne jamais faire disparaitre une couche a cause d un manifeste rate :
  // on tente la requete, un 404 sera absorbe plus haut
  assert.equal(hasCell(null, 'places', '1_1'), true)
  assert.equal(hasCell({ layers: {} }, 'places', '1_1'), true)
  assert.equal(hasCell({ layers: { places: {} } }, 'places', '1_1'), true)
})

test('le manifeste binaire reste minuscule : moins de 3 Ko pour les 3351 cellules de places', () => {
  const keys = []
  for (let r = 0; r < 90; r++) for (let c = 0; c < 180; c++) if ((r * 180 + c) % 5 === 0) keys.push(`${r}_${c}`)
  assert.ok(buildBits(2, keys).length < 3 * 1024, `taille ${buildBits(2, keys).length}`)
})

// ⚠️ QUATRE couches, plus cinq : `roads` a quitté le site le 2026-07-29
// (Adrien : « très lourd, très mauvais, tu peux le supprimer »). Le cuiseur
// itère sur CETTE table — si une couche y revenait sans son fichier source, il
// l'ignorerait avec un avertissement, mais la table doit rester le reflet
// exact de ce qu'on découpe.
test('CELL_SIZES couvre les quatre couches et divise 180 et 360', () => {
  for (const name of ['places', 'lakes', 'rivers', 'coastline']) {
    const s = CELL_SIZES[name]
    assert.ok(s > 0, `${name} sans taille`)
    assert.equal(180 % s, 0, `${name} : ${s} ne divise pas 180`)
    assert.equal(360 % s, 0, `${name} : ${s} ne divise pas 360`)
  }
})

test('plus aucune couche « roads » dans le découpage', () => {
  assert.ok(!('roads' in CELL_SIZES), 'CELL_SIZES ne doit plus connaître roads')
  assert.deepEqual(Object.keys(CELL_SIZES).sort(), ['coastline', 'lakes', 'places', 'rivers'])
})
