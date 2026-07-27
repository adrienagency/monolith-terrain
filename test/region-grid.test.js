// LE DAMIER EN MODE ISOLÉ (demande Adrien) : « si j'isole un lieu que j'ai
// nommé, ex : Le Var, quand je zoom, des tuiles nouvelles se créent pour
// contenir tout le Var, dans la limite de 5×5 ».
//
// Deux fonctions PURES portent toute la règle, et c'est ici qu'elles sont
// verrouillées :
//   · frameRegion(parts, { spanBlocks }) — le cadrage ne vise plus UN bloc mais
//     le damier ; spanBlocks = 5 lui donne les 5 dalles de côté ;
//   · cellsForParts(parts, dem) — quelles dalles du damier la zone touche
//     VRAIMENT (une dalle qui ne porte aucun morceau ne doit pas naître).
//
// ⚠️ LA RÈGLE D'ADRIEN RESTE ABSOLUE : la zone demandée tient ENTIÈREMENT dans
// ce qui est affiché, jamais un zoom en son milieu. Le damier ne dispense pas
// de la règle, il en repousse la limite de 1 bloc à 5. On ne la vérifie donc
// pas sur une formule approchée mais sur la VRAIE géoréférence du moteur
// (geo.js latLonToWorld) : chaque sommet du contour doit tomber dans le carré
// de 5 dalles. Et surtout on ne réintroduit pas le bug du plancher de zoom
// (cf. test/landmark-frame.test.js) : rien ici ne doit jamais FORCER un zoom
// plus fin que celui qui fait tenir la zone.

import { test } from 'node:test'
import assert from 'node:assert/strict'
import { frameRegion } from '../src/region-mask.js'
import { cellsForParts, GRID_R } from '../src/block-grid.js'
import { latLonToTile, latLonToWorld } from '../src/geo.js'
import { TERRAIN_SIZE } from '../src/terrain.js'

const SPAN_BLOCKS = GRID_R * 2 + 1 // 5

// DEM de synthèse calé comme dem.js (fenêtre de 3 tuiles, tuile centrale au
// milieu) — même fixture que test/region-mask.test.js
function makeDem(lat, lon, zoom) {
  const t = latLonToTile(lat, lon, zoom)
  return { zoom, size: 768, originTileX: Math.floor(t.x) - 1, originTileY: Math.floor(t.y) - 1, lat, lon }
}

const boite = (lonMin, latMin, lonMax, latMax) => [[[
  [lonMin, latMin], [lonMax, latMin], [lonMax, latMax], [lonMin, latMax], [lonMin, latMin],
]]]

// Le Var, le cas de référence d'Adrien (~100 × 80 km)
const VAR = boite(5.6, 42.98, 6.93, 43.83)

// emprise du contour en coordonnées MONDE, via la géoréférence réelle
function mondeBox(parts, dem) {
  let x0 = Infinity, x1 = -Infinity, z0 = Infinity, z1 = -Infinity
  for (const rings of parts) {
    for (const [lon, lat] of rings[0]) {
      const p = latLonToWorld(dem, Math.min(85.05, Math.max(-85.05, lat)), lon)
      if (p.x < x0) x0 = p.x
      if (p.x > x1) x1 = p.x
      if (p.z < z0) z0 = p.z
      if (p.z > z1) z1 = p.z
    }
  }
  return { x0, x1, z0, z1 }
}

// ── frameRegion : le cadrage vise le DAMIER ─────────────────────────────────

test('sans spanBlocks, frameRegion ne bouge pas d’un cran', () => {
  // le GPX, les lieux remarquables et la recherche continuent d'utiliser 1 :
  // leur cadrage ne doit pas changer parce que le mode isolé, lui, a grandi
  for (const parts of [VAR, boite(-4.8, 42.3, 8.2, 51.1), boite(55.216, -21.39, 55.837, -20.872)]) {
    assert.equal(frameRegion(parts).zoom, frameRegion(parts, { spanBlocks: 1 }).zoom)
  }
})

test('spanBlocks=5 gagne du zoom, jamais au point de faire déborder', () => {
  const un = frameRegion(VAR, { spanBlocks: 1 })
  const cinq = frameRegion(VAR, { spanBlocks: SPAN_BLOCKS })
  assert.equal(un.lat, cinq.lat, 'le centre ne dépend pas du nombre de dalles')
  assert.equal(un.lon, cinq.lon)
  // 5 dalles valent 2,32 crans : le gain est de 2 ou 3, jamais 4
  assert.ok(cinq.zoom - un.zoom >= 2, `gain trop faible : z${un.zoom} → z${cinq.zoom}`)
  assert.ok(cinq.zoom - un.zoom <= 3, `gain trop fort : z${un.zoom} → z${cinq.zoom}`)
})

test('LA RÈGLE : la zone tient ENTIÈREMENT dans les 5 dalles', () => {
  const cas = [
    ['Var', VAR],
    ['France', boite(-4.8, 42.3, 8.2, 51.1)],
    ['Réunion', boite(55.216, -21.39, 55.837, -20.872)],
    ['Corse', boite(8.53, 41.33, 9.56, 43.03)],
    ['Svalbard', boite(10, 77.5, 20, 79.5)],
    ['Chili', boite(-75, -55, -66, -18)],
  ]
  const lim = (SPAN_BLOCKS * TERRAIN_SIZE) / 2
  for (const [nom, parts] of cas) {
    const f = frameRegion(parts, { spanBlocks: SPAN_BLOCKS })
    const b = mondeBox(parts, makeDem(f.lat, f.lon, f.zoom))
    assert.ok(
      b.x0 >= -lim && b.x1 <= lim && b.z0 >= -lim && b.z1 <= lim,
      `${nom} : x[${b.x0.toFixed(1)},${b.x1.toFixed(1)}] z[${b.z0.toFixed(1)},${b.z1.toFixed(1)}] hors du damier ±${lim}`
    )
  }
})

test('la règle tient partout sur le globe, à toutes les tailles', () => {
  const lim = (SPAN_BLOCKS * TERRAIN_SIZE) / 2
  for (let lat = -75; lat <= 75; lat += 7.5) {
    for (const d of [0.01, 0.08, 0.4, 1.2, 3, 9, 25]) {
      const parts = boite(2, lat - d / 2, 2 + d, lat + d / 2)
      const f = frameRegion(parts, { spanBlocks: SPAN_BLOCKS })
      const b = mondeBox(parts, makeDem(f.lat, f.lon, f.zoom))
      assert.ok(
        b.x0 >= -lim && b.x1 <= lim && b.z0 >= -lim && b.z1 <= lim,
        `lat ${lat} d ${d} → z${f.zoom} : la zone déborde du damier`
      )
    }
  }
})

test('un span plus grand ne demande jamais un zoom plus fin', () => {
  for (const lat of [0, 43.5, 62, -49]) {
    let précédent = Infinity
    for (const d of [0.02, 0.1, 0.5, 2, 8, 30]) {
      const z = frameRegion(boite(2, lat, 2 + d, lat + d), { spanBlocks: SPAN_BLOCKS }).zoom
      assert.ok(z <= précédent, `à ${lat}° : ${d}° cadre plus fin que le précédent`)
      précédent = z
    }
  }
})

test('spanBlocks bancal retombe sur un bloc, sans NaN', () => {
  const ref = frameRegion(VAR, { spanBlocks: 1 }).zoom
  for (const bad of [0, -3, null, undefined, NaN]) {
    const f = frameRegion(VAR, { spanBlocks: bad })
    assert.ok(Number.isInteger(f.zoom), `spanBlocks ${bad} → z${f.zoom}`)
    assert.equal(f.zoom, ref, `spanBlocks ${bad} ne doit pas resserrer le cadre`)
  }
})

// ── cellsForParts : quelles dalles la zone touche VRAIMENT ──────────────────

test('une zone qui tient dans le bloc central ne réclame aucun voisin', () => {
  const dem = makeDem(43.5, 6.2, 12)
  assert.equal(cellsForParts(boite(6.19, 43.49, 6.21, 43.51), dem).size, 0)
})

test('une zone qui déborde à l’est réclame les dalles de l’est', () => {
  const dem = makeDem(43.5, 6.2, 12)
  // ~1,5 bloc vers l'est, rien vers l'ouest ni en latitude
  const cells = cellsForParts(boite(6.2, 43.49, 6.75, 43.51), dem)
  assert.ok(cells.has('1,0'), `attendu 1,0 dans ${[...cells]}`)
  assert.ok(!cells.has('-1,0'), `rien ne va vers l'ouest : ${[...cells]}`)
  assert.ok(!cells.has('0,1') && !cells.has('0,-1'), `rien ne va vers le nord/sud : ${[...cells]}`)
})

test('une dalle entièrement INTÉRIEURE à la zone est réclamée', () => {
  // Le piège du parcours d'arêtes : au centre d'un grand polygone, une dalle
  // n'est traversée par aucun segment du contour — elle est pourtant pleine.
  const dem = makeDem(43.5, 6.2, 13)
  const cells = cellsForParts(boite(4.5, 42.5, 8, 44.5), dem)
  for (const k of ['1,0', '-1,0', '0,1', '0,-1', '1,1', '-1,-1']) {
    assert.ok(cells.has(k), `la dalle ${k} est noyée dans la zone et doit naître : ${[...cells]}`)
  }
})

test('aucune dalle vide : deux îlots opposés ne réclament pas la diagonale', () => {
  const dem = makeDem(43.5, 6.2, 12)
  const bloc = 360 / 2 ** 12 * 3 // degrés de longitude par dalle à ce zoom
  const îlotA = boite(6.2 - 2.05 * bloc, 43.5 - 0.02, 6.2 - 1.95 * bloc, 43.5 + 0.02)
  const îlotB = boite(6.2 + 1.95 * bloc, 43.5 - 0.02, 6.2 + 2.05 * bloc, 43.5 + 0.02)
  const cells = cellsForParts([...îlotA, ...îlotB], dem)
  assert.ok(cells.has('-2,0') && cells.has('2,0'), `les deux îlots : ${[...cells]}`)
  assert.ok(!cells.has('0,1') && !cells.has('0,-1') && !cells.has('-1,1'), `dalles vides créées : ${[...cells]}`)
})

test('le plafond de 5×5 tient, quoi qu’on demande', () => {
  const dem = makeDem(43.5, 6.2, 14) // dalles minuscules, zone énorme
  const cells = cellsForParts(boite(-10, 35, 20, 55), dem)
  assert.equal(cells.size, (2 * GRID_R + 1) ** 2 - 1, 'le damier plein, centre exclu')
  for (const k of cells) {
    const [i, j] = k.split(',').map(Number)
    assert.ok(Math.abs(i) <= GRID_R && Math.abs(j) <= GRID_R, `${k} déborde du damier`)
    assert.ok(!(i === 0 && j === 0), 'le bloc central n’est pas une cellule du damier')
  }
})

test('les entrées bancales ne créent aucune dalle', () => {
  const dem = makeDem(43.5, 6.2, 12)
  for (const bad of [null, undefined, [], [[]], [[[]]]]) assert.equal(cellsForParts(bad, dem).size, 0)
  assert.equal(cellsForParts(VAR, null).size, 0)
  // un sommet NaN ne doit ni faire planter ni contaminer l'emprise
  assert.ok(cellsForParts([[[[NaN, 43.5], [6.2, 43.5], [6.3, 43.6], [6.2, 43.5]]]], dem) instanceof Set)
})

// ── LE CONTRAT DE BOUT EN BOUT ──────────────────────────────────────────────
// Cadrer sur 5 dalles PUIS demander les dalles : tout sommet du contour doit
// tomber soit dans le bloc central, soit dans une dalle réclamée. C'est
// exactement « des tuiles nouvelles se créent pour contenir tout le Var ».

test('cadrage + dalles : tout le Var est couvert, sans dalle en trop', () => {
  const f = frameRegion(VAR, { spanBlocks: SPAN_BLOCKS })
  const dem = makeDem(f.lat, f.lon, f.zoom)
  const cells = cellsForParts(VAR, dem)
  const H = TERRAIN_SIZE / 2
  for (const rings of VAR) {
    for (const [lon, lat] of rings[0]) {
      const p = latLonToWorld(dem, lat, lon)
      const i = Math.round(p.x / TERRAIN_SIZE)
      const j = Math.round(p.z / TERRAIN_SIZE)
      // le sommet doit tomber dans une dalle EXISTANTE (centre ou damier)
      assert.ok((i === 0 && j === 0) || cells.has(`${i},${j}`), `sommet ${lon},${lat} → dalle ${i},${j} absente`)
      assert.ok(Math.abs(p.x - i * TERRAIN_SIZE) <= H + 1e-6, 'le sommet doit tomber dans sa dalle')
    }
  }
  assert.ok(cells.size > 0, 'le Var doit déborder du bloc central à ce zoom')
})

test('le damier suit le zoom : plus on zoome, plus il y a de dalles', () => {
  const f = frameRegion(VAR, { spanBlocks: SPAN_BLOCKS })
  let précédent = -1
  for (const dz of [-2, -1, 0, 1]) {
    const n = cellsForParts(VAR, makeDem(f.lat, f.lon, f.zoom + dz)).size
    assert.ok(n >= précédent, `z${f.zoom + dz} : ${n} dalles après ${précédent}`)
    précédent = n
  }
  // et il ne dépasse jamais le plafond, même deux crans trop loin
  assert.ok(cellsForParts(VAR, makeDem(f.lat, f.lon, f.zoom + 3)).size <= (2 * GRID_R + 1) ** 2 - 1)
})
