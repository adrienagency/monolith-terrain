import { test } from 'node:test'
import assert from 'node:assert/strict'
import { detectLakes } from '../src/lake.js'

// empreinte d'un lac, indépendante de l'ordre de parcours : élévation, aire,
// boîte englobante. C'est LE critère d'Adrien — « le nombre et la forme des
// lacs trouvés doivent être identiques », pas la vitesse.
function empreintes(lakes) {
  return lakes
    .map((l) => {
      const s = l.size
      let minX = 1 / 0, maxX = -1, minY = 1 / 0, maxY = -1
      for (const c of l.cells) {
        const x = c % s
        const y = (c / s) | 0
        if (x < minX) minX = x
        if (x > maxX) maxX = x
        if (y < minY) minY = y
        if (y > maxY) maxY = y
      }
      return `${l.elevM}|${l.cells.length}|${minX},${minY},${maxX},${maxY}`
    })
    .sort()
}

// synthetic DEM: rugged slope everywhere, with hand-placed flats
function makeDem(size, fill) {
  const data = new Float32Array(size * size)
  for (let y = 0; y < size; y++)
    for (let x = 0; x < size; x++) data[y * size + x] = fill(x, y)
  return { data, size }
}

// rugged land: every cell differs from its neighbours by ≥3 m
const rugged = (x, y) => 100 + x * 3 + y * 5 + ((x * 7 + y * 13) % 4)

test('a flat plateau above sea level is detected as one lake at its elevation', () => {
  const size = 64
  const dem = makeDem(size, (x, y) => (x >= 10 && x < 30 && y >= 10 && y < 30 ? 500 : rugged(x, y)))
  const lakes = detectLakes(dem, { minCells: 50 })
  assert.equal(lakes.length, 1)
  assert.equal(lakes[0].elevM, 500)
  assert.equal(lakes[0].cells.length, 400) // 20×20 flat cells
})

test('flat regions at or below sea level belong to the sea block, not the lakes', () => {
  const size = 64
  const dem = makeDem(size, (x, y) => (x < 32 ? -5 : rugged(x, y))) // half the map is sea floor
  assert.equal(detectLakes(dem, { minCells: 50 }).length, 0)
})

test('puddles under the minimum area are ignored', () => {
  const size = 64
  const dem = makeDem(size, (x, y) => (x >= 5 && x < 8 && y >= 5 && y < 8 ? 300 : rugged(x, y)))
  assert.equal(detectLakes(dem, { minCells: 50 }).length, 0) // 3×3 = 9 cells < 50
})

test('two separate plateaus at different elevations come back as two lakes', () => {
  const size = 64
  const dem = makeDem(size, (x, y) => {
    if (x >= 4 && x < 20 && y >= 4 && y < 20) return 800
    if (x >= 40 && x < 60 && y >= 40 && y < 60) return 350
    return rugged(x, y)
  })
  const lakes = detectLakes(dem, { minCells: 50 })
  assert.equal(lakes.length, 2)
  const elevs = lakes.map((l) => l.elevM).sort((a, b) => a - b)
  assert.deepEqual(elevs, [350, 800])
})

test('tolerance groups near-level water cells without swallowing the shore', () => {
  const size = 64
  // lake surface ripples ±0.1 m (tile resampling) — inside the default tolerance
  const dem = makeDem(size, (x, y) =>
    x >= 10 && x < 40 && y >= 10 && y < 40 ? 420 + 0.1 * Math.sin(x + y) : rugged(x, y)
  )
  const lakes = detectLakes(dem)
  assert.equal(lakes.length, 1)
  assert.equal(lakes[0].cells.length, 900)
})

test('a contour band on a smooth slope is rejected — lakes are blobs, not strips', () => {
  const size = 64
  // gentle uniform slope: 0.3 m per cell along x → any seed's ±tol level set
  // is a thin vertical strip, large in area but never lake-shaped
  const dem = makeDem(size, (x) => 200 + x * 0.3)
  assert.equal(detectLakes(dem, { minCells: 50 }).length, 0)
})

test('an elongated water-flat ribbon is accepted — real lakes can be long (Annecy)', () => {
  const size = 64
  // 44×5 cells, perfectly flat at 446.7 m (a mountain ribbon lake): the old
  // thinness check killed it, the flatness rule must keep it
  const dem = makeDem(size, (x, y) => (x >= 10 && x < 54 && y >= 20 && y < 25 ? 446.5 : rugged(x, y)))
  const lakes = detectLakes(dem, { minCells: 50 })
  assert.equal(lakes.length, 1)
  assert.equal(lakes[0].elevM, 446.5)
  assert.equal(lakes[0].cells.length, 44 * 5)
})

test('an elongated band WITH internal spread is still rejected as a contour band', () => {
  const size = 64
  // same ribbon footprint but tilted 0.2 m per row across its narrow side:
  // no real water surface tilts like that. The tolerance splits it into thin
  // strips with ~0.2 m spread each — not flat, not blob-shaped, all rejected
  const dem = makeDem(size, (x, y) =>
    x >= 10 && x < 54 && y >= 20 && y < 25 ? 300 + (y - 20) * 0.2 : rugged(x, y)
  )
  assert.equal(detectLakes(dem, { minCells: 50 }).length, 0)
})

test('a crescent lake with resampling wobble on its fringe is accepted (Leman)', () => {
  const size = 64
  // a curved lake: low bounding-box fill, and a fringe of cells wobbled by
  // tile resampling across the full flood tolerance — the spread test fails,
  // the dominant-value (mode) test must still recognise water
  const inCrescent = (x, y) => {
    const dx = x - 32
    const dy = y - 44
    const r = Math.hypot(dx, dy)
    return r > 14 && r < 22 && dy < -4 // an arc band, ~330 cells
  }
  let fringe = 0
  const dem = makeDem(size, (x, y) => {
    if (!inCrescent(x, y)) return rugged(x, y)
    // every 5th lake cell wobbles up to +-0.3 m (shoreline resampling)
    fringe++
    return fringe % 5 === 0 ? 371 + (fringe % 2 ? 0.3 : -0.3) : 371
  })
  const lakes = detectLakes(dem, { minCells: 50 })
  assert.equal(lakes.length, 1)
  assert.ok(Math.abs(lakes[0].elevM - 371) <= 0.3)
})

// ═══════════════════ LE MNT DE PRODUCTION EST EN ENTIERS ═══════════════════
//
// 🔴 Découverte de la session « lacs hors du fil » : depuis dem-quant.js,
// `dem.data` est un **Int16Array en mètres ENTIERS**, pas un Float32. Les tests
// ci-dessus travaillent tous en Float32 — ils décrivent donc un régime que la
// production ne connaît plus.
//
// Conséquence, mesurée sur MNT réel (Annecy et La Réunion, emprise 3×3,
// dumps du navigateur) : avec `tolM = 0.35`, deux voisins ne se rejoignent que
// s'ils portent le MÊME entier ; toute composante est donc plate à zéro près,
// `maxH - minH` vaut 0 partout, et le test de platitude passe TOUJOURS.
// Relevé : 12 890 333 composantes à Annecy 3×3, dont **0** avec un écart
// interne non nul. L'histogramme, le mode, le remplissage et la finesse n'ont
// servi à RIEN sur du MNT de production — ils restent là pour le régime
// flottant (bancs, MNT non quantifiés) et ne se paient plus que quand ils
// servent vraiment.
test('le détecteur travaille sur le MNT de production : Int16, mètres entiers', () => {
  const size = 64
  const data = new Int16Array(size * size)
  for (let y = 0; y < size; y++)
    for (let x = 0; x < size; x++)
      data[y * size + x] = x >= 10 && x < 40 && y >= 12 && y < 38 ? 447 : Math.round(rugged(x, y))
  const lakes = detectLakes({ data, size }, { minCells: 50 })
  assert.equal(lakes.length, 1)
  assert.equal(lakes[0].elevM, 447)
  assert.equal(lakes[0].cells.length, 30 * 26)
})

// ⚠️ LE PIÈGE DU TAMPON PARTAGÉ. Les cellules ne sont plus collectées dans un
// tableau JS par composante (12,9 millions d'allocations sur une emprise 3×3,
// pour 23 lacs retenus) mais dans UN SEUL tampon réutilisé. Chaque lac retenu
// doit donc en recevoir une COPIE : servir des vues sur le tampon commun ferait
// écraser le premier lac par le second, en silence, et l'un des deux plans
// d'eau se poserait sur la forme de l'autre.
test('deux lacs ne partagent pas leurs cellules — chacun a sa propre copie', () => {
  const size = 64
  const dem = makeDem(size, (x, y) => {
    if (x >= 4 && x < 20 && y >= 4 && y < 20) return 800
    if (x >= 40 && x < 60 && y >= 40 && y < 60) return 350
    return rugged(x, y)
  })
  const lakes = detectLakes(dem, { minCells: 50 })
  assert.equal(lakes.length, 2)
  const [a, b] = lakes
  assert.notEqual(a.cells.buffer, b.cells.buffer, 'deux lacs, deux tampons')
  // et le contenu du premier survit intact à la découverte du second
  const attendu = new Set()
  for (let y = 4; y < 20; y++) for (let x = 4; x < 20; x++) attendu.add(y * size + x)
  assert.equal(a.cells.length, attendu.size)
  for (const c of a.cells) assert.ok(attendu.has(c), `cellule ${c} étrangère au premier lac`)
})

// Le témoin d'ensemble : un relief pseudo-aléatoire reproductible avec quatre
// plans d'eau plantés à la main. Il verrouille l'empreinte EXACTE (élévation,
// aire, boîte) de ce que le détecteur rend — c'est ce test qui attrape une
// dérive de sémantique qu'un gain de vitesse aurait introduite.
test('témoin d’ensemble : les empreintes des lacs sont figées', () => {
  const size = 192
  const data = new Int16Array(size * size)
  let g = 12345
  const rnd = () => ((g = (g * 1103515245 + 12345) & 0x7fffffff), g / 0x7fffffff)
  for (let y = 0; y < size; y++)
    for (let x = 0; x < size; x++) data[y * size + x] = 200 + Math.round(x * 1.7 + y * 2.3 + rnd() * 40)
  const poser = (x0, y0, w, h, e) => {
    for (let y = y0; y < y0 + h; y++) for (let x = x0; x < x0 + w; x++) data[y * size + x] = e
  }
  poser(20, 20, 40, 30, 500) // blob franc
  poser(90, 10, 60, 6, 640) // ruban étroit (type Annecy)
  poser(10, 120, 8, 8, 700) // flaque sous le plancher d'aire
  poser(100, 100, 50, 50, 900) // grand blob
  const emp = empreintes(detectLakes({ data, size }, { minCells: 200 }))
  assert.deepEqual(emp, ['500|1200|20,20,59,49', '640|360|90,10,149,15', '900|2500|100,100,149,149'])
})
