// LA RÈGLE DE BASE, mise sous test (Adrien, « à ne pas contourner ») :
// cliquer un lieu remarquable montre la ZONE ENTIÈRE, jamais un zoom en son
// milieu. Le zoom des tuiles étant ENTIER, la zone remplit le bloc entre ~50 %
// et 100 % — c'est admis. Ce qui ne l'est pas, c'est qu'elle DÉBORDE.
//
// On travaille sur la fonction pure `zoomForSpanKm` avec les vrais spans de la
// liste ISLAND_SPANS : ce sont eux qui partent dans le panneau Explorer, via
// ISLANDS → placeRow → ctx.flyTo → modes.flyTo → loadSurface → loadDem.

import { test } from 'node:test'
import assert from 'node:assert/strict'
import { ISLANDS, zoomForSpanKm, blockExtentMeters, blockFitMeters, BLOCK_TILES } from '../src/landmarks.js'

// Spans réels relevés dans ISLAND_SPANS (src/landmarks.js), recopiés ici pour
// que le test échoue AUSSI si quelqu'un touche à la liste sans y penser.
const SPANS = {
  'Tenerife (Teide)': 80,
  'La Palma': 45,
  Madeira: 57,
  Socotra: 130,
  'Hawai‘i (Big Island)': 150,
  'Kaua‘i': 50,
  Bali: 145,
  'Isle of Skye': 80,
  'Faroe Islands': 110,
  'Jan Mayen (Beerenberg)': 55,
  Kerguelen: 150,
  Ischia: 10,
  Capri: 6,
}

// ── la géométrie du bloc doit rester celle du moteur ────────────────────────
// dem.js : metersPerPixel = 156543.03392·cos(lat)/2^z · (256/TILE_PX)
//          extentMeters   = metersPerPixel · (tilesAcross · TILE_PX)
// Les TILE_PX se simplifient : l'emprise ne dépend QUE du zoom, de la latitude
// et du nombre de dalles. Si ce test casse, c'est dem.js qui a bougé.
test('blockExtentMeters reproduit le dem.extentMeters du moteur', () => {
  assert.equal(BLOCK_TILES, 3, 'le socle charge 3 dalles de côté (dem.js: tilesAcross = 3)')
  for (const tilePx of [256, 512]) {
    for (const [lat, zoom] of [
      [0, 9],
      [45.83, 12],
      [-49.3, 8],
      [71, 9],
    ]) {
      const metersPerPixel = ((156543.03392 * Math.cos((lat * Math.PI) / 180)) / 2 ** zoom) * (256 / tilePx)
      const attendu = metersPerPixel * (BLOCK_TILES * tilePx)
      const obtenu = blockExtentMeters(zoom, lat)
      assert.ok(Math.abs(obtenu - attendu) < 1e-6, `z${zoom} lat${lat} tuiles ${tilePx}px : ${obtenu} ≠ ${attendu}`)
    }
  }
})

// Le bloc est un carré en MERCATOR, pas au sol : vers le pôle sa largeur
// est-ouest rétrécit. La dimension utile est donc plus petite que l'emprise
// nominale, et c'est elle qui décide si l'île déborde.
test('la dimension utile ne dépasse jamais l’emprise nominale', () => {
  for (let lat = -80; lat <= 80; lat += 5) {
    for (const z of [8, 9, 10, 12, 15]) {
      const fit = blockFitMeters(z, lat)
      assert.ok(fit > 0, `z${z} lat${lat} : dimension utile nulle`)
      assert.ok(fit <= blockExtentMeters(z, lat) + 1e-6, `z${z} lat${lat} : utile ${fit} > nominal`)
    }
  }
  // à l'équateur les deux se confondent (à l'ellipsoïde près)
  assert.ok(Math.abs(blockFitMeters(9, 0) / blockExtentMeters(9, 0) - 1) < 0.005)
})

// ── LA RÈGLE ────────────────────────────────────────────────────────────────
test('chaque île de la liste tient ENTIÈREMENT sur le bloc', () => {
  for (const île of ISLANDS) {
    const span = SPANS[île.name]
    if (span == null) continue // la liste peut s'allonger ; on teste ce qu'on connaît
    const utile = blockFitMeters(île.zoom, île.lat) / 1000
    assert.ok(
      span <= utile,
      `${île.name} : span ${span} km dans un bloc de ${utile.toFixed(1)} km à z${île.zoom} — la zone déborde`
    )
  }
})

test('aucune île ne perd le bloc dans un dézoom inutile', () => {
  for (const île of ISLANDS) {
    const span = SPANS[île.name]
    if (span == null) continue
    const utile = blockFitMeters(île.zoom, île.lat) / 1000
    // zoom ENTIER : un cran de plus diviserait l'emprise par deux, donc le
    // remplissage ne peut pas descendre sous ~45 % sans qu'un cran manque.
    assert.ok(span / utile >= 0.45, `${île.name} : ne remplit que ${Math.round((span / utile) * 100)} % du bloc`)
  }
})

// ── LA RÉGRESSION QUI A MOTIVÉ LE CORRECTIF ─────────────────────────────────
// `min` est le zoom le plus GROSSIER souhaité (9 pour les îles). Le respecter
// veut dire zoomer PLUS FIN, donc rétrécir le bloc sous la taille de la zone :
// c'est exactement le zoom au milieu interdit. Les Féroé le prouvaient.
test('le plancher de zoom ne coupe jamais une zone en deux', () => {
  const féroé = { span: 110, lat: 62.08 }
  const z = zoomForSpanKm(féroé.span, féroé.lat, { min: 9, max: 15 })
  assert.ok(z < 9, `le plancher min:9 doit céder, obtenu z${z}`)
  assert.ok(
    blockFitMeters(z, féroé.lat) / 1000 >= féroé.span,
    `Féroé : ${blockFitMeters(z, féroé.lat) / 1000} km de bloc pour 110 km d’archipel`
  )
  // avant correctif : z9, un bloc de 108,2 km utiles — l'archipel dépassait
  assert.ok(blockFitMeters(9, féroé.lat) / 1000 < féroé.span, 'le cas de régression doit rester un cas de régression')

  // Kerguelen passait à 0,7 % près, sans aucune marge
  const kerg = zoomForSpanKm(150, -49.3, { min: 9, max: 15 })
  assert.ok(blockFitMeters(kerg, -49.3) / 1000 >= 150 * 1.05, 'Kerguelen doit avoir de l’air autour')
})

test('un plancher de zoom absurde ne peut pas non plus couper', () => {
  // min:14 sur une île de 130 km : le souhait est intenable, la règle prime
  const z = zoomForSpanKm(130, 12.5, { min: 14, max: 15 })
  assert.ok(blockFitMeters(z, 12.5) / 1000 >= 130, `min:14 a coupé Socotra (z${z})`)
})

// `max` (le zoom le plus FIN autorisé) ne fait que dézoomer : il ne coupe rien.
test('le plafond de zoom s’applique et ne coupe rien', () => {
  const z = zoomForSpanKm(0.5, 45, { min: 4, max: 12 })
  assert.equal(z, 12, 'une zone minuscule s’arrête au plafond')
  assert.ok(blockFitMeters(z, 45) / 1000 >= 0.5)
})

// ── propriétés générales, sur tout le globe ─────────────────────────────────
test('la règle tient pour n’importe quel span à n’importe quelle latitude', () => {
  for (let lat = -80; lat <= 80; lat += 2.5) {
    for (const span of [0.5, 3, 11, 27, 55, 80, 110, 150, 230, 400, 900, 2500]) {
      for (const opts of [{ min: 9, max: 15 }, { min: 4, max: 15 }, { min: 4, max: 12 }]) {
        const z = zoomForSpanKm(span, lat, opts)
        assert.ok(Number.isInteger(z), `z non entier : ${z}`)
        assert.ok(z <= opts.max, `z${z} dépasse le plafond`)
        const utile = blockFitMeters(z, lat) / 1000
        // le plafond peut légitimement empêcher de dézoomer ? non : le plafond
        // est le zoom le plus FIN, dézoomer reste toujours possible.
        assert.ok(span <= utile, `span ${span} km à ${lat}° → z${z}, bloc ${utile.toFixed(1)} km : ça déborde`)
      }
    }
  }
})

test('un span plus grand ne demande jamais un zoom plus fin', () => {
  for (const lat of [0, 28.27, 45.83, 62.08, -49.3]) {
    let précédent = Infinity
    for (const span of [1, 5, 12, 30, 60, 120, 240, 500]) {
      const z = zoomForSpanKm(span, lat, { min: 9, max: 15 })
      assert.ok(z <= précédent, `à ${lat}° : span ${span} km cadre plus fin que le précédent`)
      précédent = z
    }
  }
})

test('les entrées bancales ne cassent pas le cadrage', () => {
  for (const bad of [0, null, undefined, -12, NaN]) {
    const z = zoomForSpanKm(bad, 45, { min: 4, max: 15 })
    assert.ok(Number.isInteger(z) && z >= 4 && z <= 15, `span ${bad} → z${z}`)
  }
})
