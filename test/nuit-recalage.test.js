import { test } from 'node:test'
import assert from 'node:assert/strict'
import { demBounds, aerialZoomFor, aerialUvTransform, tileGridMerc, lonLatToMerc } from '../src/map/aerial-layer.js'
import { tilesForBBox } from '../src/map/tile-index.js'
import { zoomNuitBorne, NUIT_ZOOM_MAX } from '../src/nuit.js'
import { latLonToWorld, demSpan } from '../src/geo.js'

// ═══════════════════════════════════════════════════════════════════════════
// LE RECALAGE DES MOSAÏQUES DRAPÉES — un point de sol doit lire SON texel
// ═══════════════════════════════════════════════════════════════════════════
//
// LE DÉFAUT, tel qu'Adrien l'a vu : « la map d'éclairage nocturne est toujours
// décalée ». Les villes n'atterrissaient pas sous leurs étiquettes.
//
// MESURÉ AVANT CORRECTION (docs/nuit-recalage/mesure-chaine.mjs, qui rejoue la
// chaîne complète en nombres) : l'écart est RIGOUREUSEMENT NUL en longitude et
// grand en latitude — 4 km à Reykjavik, 24 km à Las Vegas, 63 km à Nouméa,
// 84 km à Paris, jusqu'à 131 km sur une emprise 3×3 à Dakar. Ni constant, ni
// proportionnel au zoom, ni croissant avec la latitude : il saute d'un bloc à
// l'autre. Cette forme-là ne laisse qu'un seul suspect — un décalage de
// GRILLE, pas d'échelle ni de projection.
//
// LA CAUSE. Les deux couches drapées (photo aérienne et lumières nocturnes)
// posent leur mosaïque avec un offset/échelle calculé par `aerialUvTransform`,
// puis le shader lit :
//
//     vec2 uv = uvSolDrape(...);   // ⚠️ contient `uv.y = 1.0 - uv.y`
//     uv = uOffset + uv * uScale;  // l'affine de la couche
//
// Le retournement de `uvSolDrape` compense le `flipY = true` des
// CanvasTexture — c'est lui qui fait qu'en UV, v = 0 est le bord SUD de la
// mosaïque, et non son bord nord. Mais `aerialUvTransform` rendait un offset
// mesuré depuis le bord NORD de la grille de tuiles. Un retournement et une
// affine NE COMMUTENT PAS : la mosaïque se retrouvait décalée verticalement
// de (débord nord − débord sud) de la grille.
//
// POURQUOI ÇA NE SE VOYAIT PAS SUR LA PHOTO. Quand le zoom d'imagerie est ≥ au
// zoom du DEM — le cas de TOUS les fournisseurs nationaux — les bords de la
// grille de tuiles coïncident exactement avec les bords du bloc : les deux
// débords valent zéro, la différence aussi, et l'erreur est invisible. Les
// lumières nocturnes, elles, sont plafonnées à z8 (résolution du capteur
// VIIRS), donc bien plus GROSSIÈRES que le DEM : le bloc flotte quelque part
// dans une tuile de 156 km, et le débord vaut ce qu'il veut.
//
// ⚠️ La photo aérienne était donc fausse elle aussi, partout où le PLANCHER
// MONDIAL NASA (maxZoom 8) sert de fournisseur principal — c'est-à-dire en
// mer et dans tout pays sans fournisseur national. C'est vérifié plus bas.

// Le même dem fictif que test/aerial-layer.test.js : trois tuiles de côté.
function demFictif(lat, lon, zoom, cote = 1, tilePx = 512) {
  const n = 2 ** zoom
  const r = (lat * Math.PI) / 180
  const cx = Math.floor(((lon + 180) / 360) * n)
  const cy = Math.floor(((1 - Math.log(Math.tan(r) + 1 / Math.cos(r)) / Math.PI) / 2) * n)
  const debord = cote > 1 ? 3 : 0
  return {
    size: 3 * tilePx * cote, tilePx, zoom,
    originTileX: cx - 1 - debord, originTileY: cy - 1 - debord,
    ...(cote > 1 ? { empriseCote: cote } : {}),
  }
}

const mercVersLonLat = (x, y) => ({
  lon: x * 360 - 180,
  lat: (Math.atan(Math.sinh(Math.PI * (1 - 2 * y))) * 180) / Math.PI,
})

// LE JUMEAU DU SHADER, en JS. Le GLSL n'est pas exécutable sous node ; ces
// quatre lignes reproduisent `uvSolDrape` puis l'affine de la couche, EXACTEMENT
// comme terrain.js les enchaîne (uBlockOffset et uFenetre valent (0,0) hors
// déplacement, et uMaskSpan vaut demSpan(dem)). Si le GLSL bouge, ces lignes
// doivent bouger avec — la preuve par l'image est dans docs/nuit-recalage/.
function texelLu(dem, uv, grid, lat, lon) {
  const span = demSpan(dem)
  const w = latLonToWorld(dem, lat, lon)
  const uvx = w.x / span + 0.5
  const uvy = w.z / span + 0.5 // 0 au NORD : le +Z du monde va vers le sud
  const nu = uv.offset[0] + uvx * uv.scale[0]
  const nv = uv.offset[1] + (1 - uvy) * uv.scale[1] // `uv.y = 1.0 - uv.y` du shader
  // flipY = true sur la CanvasTexture (aucun `tex.flipY = false` dans
  // aerial-layer.js ni nuit-layer.js, à l'inverse de tous les autres masques du
  // projet) : v = 1 est la PREMIÈRE ligne du canevas, celle du nord.
  const gw = grid.maxX - grid.minX, gh = grid.maxY - grid.minY
  return mercVersLonLat(grid.minX + nu * gw, grid.minY + (1 - nv) * gh)
}

// La chaîne complète, telle que NuitLayer.build / AerialLayer.build l'exécutent.
function ecartKm(lat, lon, zoomDem, { cote = 1, budgetPx = 1024, maxZoom = NUIT_ZOOM_MAX, borne = true } = {}) {
  const dem = demFictif(lat, lon, zoomDem, cote)
  const bbox = demBounds(dem)
  const brut = aerialZoomFor(bbox, { budgetPx, maxZoom })
  const z = borne ? zoomNuitBorne(brut) : brut
  const tuiles = tilesForBBox(bbox, z)
  const xs = tuiles.map((t) => t.x), ys = tuiles.map((t) => t.y)
  const x0 = Math.min(...xs), y0 = Math.min(...ys)
  const cols = Math.max(...xs) - x0 + 1, rows = Math.max(...ys) - y0 + 1
  const grid = tileGridMerc(x0, y0, cols, rows, z)
  const vu = texelLu(dem, aerialUvTransform(bbox, grid), grid, lat, lon)
  return {
    est: (vu.lon - lon) * 111.32 * Math.cos((lat * Math.PI) / 180),
    nord: (vu.lat - lat) * 110.57,
  }
}

// Des villes ISOLÉES, dont la position est connue, et réparties sur les deux
// hémisphères et sur toute la gamme de latitudes : un décalage constant, un
// décalage proportionnel au zoom et un décalage croissant avec la latitude ont
// trois causes différentes, et seul un jeu large les distingue.
const VILLES = [
  ['Reykjavik', 64.1466, -21.9426],
  ['Anchorage', 61.2181, -149.9003],
  ['Paris', 48.8566, 2.3522],
  ['Las Vegas', 36.1699, -115.1398],
  ['Honolulu', 21.3069, -157.8583],
  ['Dakar', 14.7167, -17.4677],
  ['Noumea', -22.2758, 166.458],
  ['Perth', -31.9523, 115.8613],
]

// 200 m : très en dessous du pixel source de Black Marble (~600 m), donc rien
// d'observable ne passe sous ce seuil, et très au-dessus du bruit flottant.
const TOLERANCE_KM = 0.2

test('lumières nocturnes : la mosaïque tombe sur la ville, à TOUS les zooms', () => {
  for (const zoom of [9, 10, 11, 12, 13, 14]) {
    for (const [nom, lat, lon] of VILLES) {
      const e = ecartKm(lat, lon, zoom)
      assert.ok(
        Math.hypot(e.est, e.nord) < TOLERANCE_KM,
        `${nom} zoom ${zoom} : ${e.est.toFixed(2)} km E, ${e.nord.toFixed(2)} km N`
      )
    }
  }
})

test('lumières nocturnes : le mode continu 3×3 est calé lui aussi', () => {
  // L'emprise triple la largeur du champ ET fait basculer la grille sur 2×2
  // tuiles z8 — le débord change complètement, et c'est là que l'écart mesuré
  // avant correction était le plus gros (131 km à Dakar).
  for (const zoom of [10, 11, 12]) {
    for (const [nom, lat, lon] of VILLES) {
      const e = ecartKm(lat, lon, zoom, { cote: 3 })
      assert.ok(
        Math.hypot(e.est, e.nord) < TOLERANCE_KM,
        `${nom} emprise 3×3 zoom ${zoom} : ${e.est.toFixed(2)} km E, ${e.nord.toFixed(2)} km N`
      )
    }
  }
})

test('photo aérienne : le témoin national reste calé au bit près', () => {
  // Ce cas-là marchait DÉJÀ (zoom d'imagerie ≥ zoom du DEM, donc grille et bloc
  // coïncident). Il est ici pour interdire toute régression : la correction ne
  // doit pas déplacer d'un mètre ce qui était juste.
  for (const [nom, lat, lon] of VILLES) {
    const e = ecartKm(lat, lon, 12, { budgetPx: 4096, maxZoom: 19, borne: false })
    assert.ok(Math.hypot(e.est, e.nord) < TOLERANCE_KM, `${nom} : ${e.est.toFixed(2)} E, ${e.nord.toFixed(2)} N`)
  }
})

test('photo aérienne : le plancher mondial NASA était faux, et ne l’est plus', () => {
  // maxZoom 8, comme les lumières nocturnes : ce fournisseur sert la MER et
  // tout pays sans fournisseur national. Il portait exactement le même défaut,
  // et personne ne l'avait vu parce que le calage n'avait été vérifié que sur
  // la France.
  for (const [nom, lat, lon] of VILLES) {
    const e = ecartKm(lat, lon, 12, { budgetPx: 4096, maxZoom: 8, borne: false })
    assert.ok(Math.hypot(e.est, e.nord) < TOLERANCE_KM, `${nom} : ${e.est.toFixed(2)} E, ${e.nord.toFixed(2)} N`)
  }
})

test('aerialUvTransform : l’origine des UV est le coin SUD-ouest de la grille', () => {
  // LE TEST QUI MANQUAIT. Les trois cas existants dans aerial-layer.test.js ont
  // tous une grille SYMÉTRIQUE autour de l'emprise (débord identique en haut et
  // en bas) — et c'est précisément le seul cas où l'erreur s'annule. Ici le
  // débord est délibérément ASYMÉTRIQUE : un quart au nord, trois quarts au sud.
  const patch = { minLon: 0, maxLon: 1, minLat: 45, maxLat: 46 }
  const a = lonLatToMerc(patch.minLon, patch.maxLat) // haut-gauche
  const b = lonLatToMerc(patch.maxLon, patch.minLat) // bas-droite
  const h = b.y - a.y
  const grid = { minX: a.x, maxX: b.x, minY: a.y - h * 0.25, maxY: b.y + h * 0.75 }
  const gh = grid.maxY - grid.minY
  const t = aerialUvTransform(patch, grid)
  // v = 0 est le bord SUD de la grille : l'offset vertical se mesure donc
  // depuis le bas, soit le débord SUD, et non le débord nord.
  const debordSud = (grid.maxY - b.y) / gh
  assert.ok(
    Math.abs(t.offset[1] - debordSud) < 1e-12,
    `offset.y ${t.offset[1]} devrait valoir le débord SUD ${debordSud}, pas le débord nord`
  )
  assert.ok(Math.abs(t.scale[1] - h / gh) < 1e-12)
})
