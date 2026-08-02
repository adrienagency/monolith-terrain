import { test } from 'node:test'
import assert from 'node:assert/strict'
import {
  BATHY_BASE_ZMAX,
  BATHY_ZMIN,
  SOURCES,
  normalizeIndex,
  zoneAt,
  cascadeAt,
  bathyMaxZoom,
  tileMaxZoom,
  maxZoomForBounds,
  creditsForBounds,
  spanContainsLon,
} from '../src/bathy-sources.js'

// Index de travail : la France metropolitaine servie par EMODnet a z10, la
// cote est des Etats-Unis par BlueTopo a z12. Volontairement dans le desordre
// pour verifier que le tri ne depend pas de l'ordre du fichier.
const INDEX = normalizeIndex({
  version: 1,
  zmin: 4,
  base: { source: 'gebco', zmax: 8 },
  zones: [
    { id: 'us-east', source: 'bluetopo', zmax: 12, bbox: [-82, 24, -66, 45] },
    { id: 'fr-metro', source: 'emodnet', zmax: 10, bbox: [-6, 41, 10, 52] },
  ],
})

// ------------------------------------------------------- appartenance en longitude

test('spanContainsLon : un intervalle ordinaire se lit tel quel', () => {
  assert.equal(spanContainsLon(5, 0, 10), true)
  assert.equal(spanContainsLon(-5, 0, 10), false)
})

test('spanContainsLon : un intervalle a cheval sur l antimeridien (ouest > est)', () => {
  // Fidji : de 175E a 178O, donc west = 175, east = -178
  assert.equal(spanContainsLon(179, 175, -178), true)
  assert.equal(spanContainsLon(-179, 175, -178), true)
  assert.equal(spanContainsLon(0, 175, -178), false)
})

test('spanContainsLon : une longitude qui deborde (+185) est repliee sur le tore', () => {
  // patchBounds ajoute un padding qui peut pousser au-dela de +-180
  assert.equal(spanContainsLon(185, -180, -170), true)
  assert.equal(spanContainsLon(-185, 170, 180), true)
})

// --------------------------------------------------------------- normalisation

test('normalizeIndex : un index absent rend le socle GEBCO, jamais une exception', () => {
  const idx = normalizeIndex(null)
  assert.equal(idx.base.zmax, BATHY_BASE_ZMAX)
  assert.deepEqual(idx.zones, [])
})

test('normalizeIndex : une zone illisible est ecartee sans emporter les autres', () => {
  const idx = normalizeIndex({
    zones: [
      { id: 'cassee', bbox: [1, 2] },
      { id: 'sans-bbox', source: 'emodnet', zmax: 10 },
      { id: 'bonne', source: 'emodnet', zmax: 10, bbox: [-6, 41, 10, 52] },
    ],
  })
  assert.deepEqual(idx.zones.map((z) => z.id), ['bonne'])
})

test('normalizeIndex : une zone qui pretend descendre SOUS le socle est relevee au socle', () => {
  // Un zmax de 6 ferait un TROU : la boucle du chargeur partirait de z6 alors
  // que les tuiles z8 GEBCO existent. Le plafond par zone ne peut qu'ajouter.
  const idx = normalizeIndex({ zones: [{ id: 'x', source: 'emodnet', zmax: 6, bbox: [0, 0, 1, 1] }] })
  assert.equal(idx.zones[0].zmax, BATHY_BASE_ZMAX)
})

test('normalizeIndex : une source inconnue reste utilisable mais sans credit invente', () => {
  const idx = normalizeIndex({ zones: [{ id: 'x', source: 'mystere', zmax: 11, bbox: [0, 0, 1, 1] }] })
  assert.equal(idx.zones[0].zmax, 11)
  const c = creditsForBounds(idx, { minLat: 0.2, maxLat: 0.8, minLon: 0.2, maxLon: 0.8 })
  // le trou d attribution doit etre VISIBLE, pas comble par une phrase inventee
  assert.ok(c.some((t) => t.includes('mystere') && t.includes('attribution à compléter')))
  assert.ok(c.some((t) => t.includes('GEBCO')), 'le socle reste cite')
})

// ------------------------------------------------------------------ la cascade

test('cascade : la rade de Brest est servie par EMODnet a z10', () => {
  const z = zoneAt(INDEX, 48.35, -4.5)
  assert.equal(z.id, 'fr-metro')
  assert.equal(bathyMaxZoom(INDEX, 48.35, -4.5), 10)
})

test('cascade : la baie de Tokyo n est couverte par personne, on reste sur GEBCO', () => {
  assert.equal(zoneAt(INDEX, 35.5, 139.85), null)
  assert.equal(bathyMaxZoom(INDEX, 35.5, 139.85), BATHY_BASE_ZMAX)
})

test('cascade : la pleine mer aussi retombe sur GEBCO, jamais sur rien', () => {
  assert.equal(bathyMaxZoom(INDEX, -40, -30), BATHY_BASE_ZMAX)
})

test('DEUX sources sur la meme zone : la plus fine gagne', () => {
  // Une zone Copernicus mondiale a z10 par-dessus BlueTopo z12 sur la Floride :
  // c'est BlueTopo qui doit sortir, quel que soit l ordre de declaration.
  const idx = normalizeIndex({
    zones: [
      { id: 'monde-sdb', source: 'copernicus', zmax: 10, bbox: [-180, -80, 180, 80] },
      { id: 'us-east', source: 'bluetopo', zmax: 12, bbox: [-82, 24, -66, 45] },
    ],
  })
  assert.equal(zoneAt(idx, 25.5, -80.5).id, 'us-east')
  assert.equal(bathyMaxZoom(idx, 25.5, -80.5), 12)
  // et hors de la zone fine, la mondiale reprend la main
  assert.equal(zoneAt(idx, 25.5, -20).id, 'monde-sdb')
})

test('cascadeAt rend les sources du plus fin au plus grossier, socle compris', () => {
  const idx = normalizeIndex({
    zones: [
      { id: 'monde-sdb', source: 'copernicus', zmax: 10, bbox: [-180, -80, 180, 80] },
      { id: 'us-east', source: 'bluetopo', zmax: 12, bbox: [-82, 24, -66, 45] },
    ],
  })
  assert.deepEqual(cascadeAt(idx, 25.5, -80.5).map((s) => s.zmax), [12, 10, BATHY_BASE_ZMAX])
  // le dernier maillon est TOUJOURS le socle : c est lui qui interdit le trou
  assert.equal(cascadeAt(idx, 25.5, -80.5).at(-1).source, 'gebco')
  // au-dela de 80 degres sud, plus aucune zone : il ne reste QUE le socle
  assert.deepEqual(cascadeAt(idx, -85, -30).map((s) => s.source), ['gebco'])
})

// ------------------------------- un trou dans une source fine ne fait pas un trou

test('un TROU dans une source fine laisse quand meme des niveaux a lire', () => {
  // Le contrat que le chargeur doit pouvoir tenir : entre le plafond de la
  // zone et le plancher du jeu, il reste toute la descente z10 -> z9 -> z8 ...
  // Si la tuile z10 manque (trou EMODnet rebouche par GEBCO, ou tuile jamais
  // cuite parce que trop profonde), la boucle trouve forcement un ancetre.
  const zmax = bathyMaxZoom(INDEX, 48.35, -4.5)
  const niveaux = []
  for (let z = zmax; z >= BATHY_ZMIN; z--) niveaux.push(z)
  assert.deepEqual(niveaux, [10, 9, 8, 7, 6, 5, 4])
  assert.ok(niveaux.includes(BATHY_BASE_ZMAX), 'le socle GEBCO reste sur le chemin de repli')
})

test('le plafond par zone ne descend JAMAIS sous le socle, meme index farfelu', () => {
  const idx = normalizeIndex({ base: { source: 'gebco', zmax: 8 }, zones: [] })
  for (const [lat, lon] of [[0, 0], [90, 180], [-90, -180], [48.35, -4.5], [35.5, 139.85]]) {
    assert.ok(bathyMaxZoom(idx, lat, lon) >= BATHY_BASE_ZMAX, `${lat}/${lon}`)
  }
})

test('un index absent se comporte exactement comme aujourd hui : z8 partout', () => {
  assert.equal(bathyMaxZoom(null, 48.35, -4.5), BATHY_BASE_ZMAX)
  assert.equal(bathyMaxZoom(undefined, 48.35, -4.5), BATHY_BASE_ZMAX)
  assert.equal(bathyMaxZoom({ zones: 'nawak' }, 48.35, -4.5), BATHY_BASE_ZMAX)
})

// ------------------------------------------------------------- antimeridien

test('ANTIMERIDIEN : une zone a cheval sur +-180 est reconnue des deux cotes', () => {
  const idx = normalizeIndex({
    zones: [{ id: 'fidji', source: 'copernicus', zmax: 10, bbox: [176, -20, -178, -15] }],
  })
  assert.equal(bathyMaxZoom(idx, -17, 179), 10)
  assert.equal(bathyMaxZoom(idx, -17, -179), 10)
  assert.equal(bathyMaxZoom(idx, -17, 0), BATHY_BASE_ZMAX)
})

test('ANTIMERIDIEN : maxZoomForBounds absorbe une emprise enroulee (minLon > maxLon)', () => {
  // patchBounds rend minLon = 179,8 / maxLon = -179,9 sur un bloc a cheval
  const idx = normalizeIndex({
    zones: [{ id: 'fidji', source: 'copernicus', zmax: 10, bbox: [176, -20, -178, -15] }],
  })
  assert.equal(maxZoomForBounds(idx, { minLat: -18, maxLat: -16, minLon: 179.8, maxLon: -179.9 }), 10)
})

// ⚠️ CE TEST A CHANGE DE PREMISSE LE 2026-08-02.
//
// Il verrouillait l'heuristique « plus de 180 degres = un enroulement », qui
// rattrapait la forme TRIEE que `patchBounds` produisait alors. Les deux sont
// parties ensemble. Il ne restait d'ailleurs vrai que par accident : la garde de
// LATITUDE (bounds a -18..-16, zone a 41..52) suffisait a le faire passer, et il
// aurait continue a passer quoi qu'on fasse de la longitude.
//
// L'emprise enroulee s'ecrit desormais ouest > est, et c'est cette forme-la
// qu'on verrouille.
test('ANTIMERIDIEN : une emprise enroulee (ouest > est) ne touche pas les zones a l autre bout du globe', () => {
  const idx = normalizeIndex({
    zones: [{ id: 'fr-metro', source: 'emodnet', zmax: 10, bbox: [-6, 41, 10, 52] }],
  })
  // Aux Fidji, a la MEME latitude que la zone francaise pour que seule la
  // longitude puisse trancher.
  const enroule = { minLat: 44, maxLat: 46, minLon: 179.8, maxLon: -179.9 }
  assert.equal(maxZoomForBounds(idx, enroule), BATHY_BASE_ZMAX)
})

test('UNE LARGE EMPRISE 3x3 GARDE SA BATHYMETRIE FINE — ET SON CREDIT EMODNET', () => {
  // MESURE : une emprise 3x3 fait NEUF tuiles de large, donc 202,5 degres a z4.
  // L'heuristique des 180 degres en prenait le COMPLEMENT et il en sortait deux
  // degats : `maxZoomForBounds` retombait au socle GEBCO (6 au lieu de 10), et
  // le credit EMODnet DISPARAISSAIT — ce que ce fichier qualifie lui-meme
  // d'obligation de licence.
  const idx = normalizeIndex({
    zones: [{ id: 'emodnet', source: 'emodnet', zmax: 10, bbox: [-36, 25, 43, 90] }],
  })
  const large = { minLat: 17.9, maxLat: 64.7, minLon: -101.25, maxLon: 101.25 }
  assert.equal(maxZoomForBounds(idx, large), 10, 'la bathymetrie fine est refusee sur une emprise 3x3')
  const credits = creditsForBounds(idx, large)
  assert.ok(credits.some((c) => /EMODnet/.test(c)), `credit EMODnet absent : ${JSON.stringify(credits)}`)
})

test('maxZoomForBounds : une emprise qui touche une zone fine prend son plafond', () => {
  assert.equal(
    maxZoomForBounds(INDEX, { minLat: 48.2, maxLat: 48.5, minLon: -4.7, maxLon: -4.3 }),
    10
  )
  assert.equal(
    maxZoomForBounds(INDEX, { minLat: 35.2, maxLat: 35.7, minLon: 139.6, maxLon: 140.1 }),
    BATHY_BASE_ZMAX
  )
})

test('maxZoomForBounds : une emprise sans bornes finies retombe sur le socle', () => {
  assert.equal(maxZoomForBounds(INDEX, null), BATHY_BASE_ZMAX)
  assert.equal(maxZoomForBounds(INDEX, { minLat: NaN, maxLat: 1, minLon: 0, maxLon: 1 }), BATHY_BASE_ZMAX)
})

// ------------------------------------------------------------- bord des zones

test('les bords de bbox sont INCLUSIFS : une tuile pile sur la limite est servie', () => {
  assert.equal(bathyMaxZoom(INDEX, 41, -6), 10)
  assert.equal(bathyMaxZoom(INDEX, 52, 10), 10)
  assert.equal(bathyMaxZoom(INDEX, 52.001, 10), BATHY_BASE_ZMAX)
})

// -------------------------------------------------------------- par tuile XYZ

test('tileMaxZoom traduit une tuile XYZ en plafond, par son CENTRE', () => {
  // z8 : la rade de Brest tombe en x=126, y=87
  const n = 2 ** 8
  const x = Math.floor(((-4.5 + 180) / 360) * n)
  const s = Math.sin((48.35 * Math.PI) / 180)
  const y = Math.floor((0.5 - Math.log((1 + s) / (1 - s)) / (4 * Math.PI)) * n)
  assert.equal(tileMaxZoom(INDEX, 8, x, y), 10)
  assert.equal(tileMaxZoom(INDEX, 8, 227, 100), BATHY_BASE_ZMAX) // baie de Tokyo
})

test('tileMaxZoom : un x qui deborde du monde est replie, pas rejete', () => {
  const n = 2 ** 8
  const x = Math.floor(((-4.5 + 180) / 360) * n)
  const s = Math.sin((48.35 * Math.PI) / 180)
  const y = Math.floor((0.5 - Math.log((1 + s) / (1 - s)) / (4 * Math.PI)) * n)
  assert.equal(tileMaxZoom(INDEX, 8, x + n, y), 10)
  assert.equal(tileMaxZoom(INDEX, 8, x - n, y), 10)
})

test('tileMaxZoom : une tuile hors monde en Y retombe sur le socle sans exploser', () => {
  assert.equal(tileMaxZoom(INDEX, 8, 126, -1), BATHY_BASE_ZMAX)
  assert.equal(tileMaxZoom(INDEX, 8, 126, 999), BATHY_BASE_ZMAX)
})

// ------------------------------------------------------------------ licences

test('CREDITS : GEBCO est cite partout, parce qu il est toujours sous la carte', () => {
  const c = creditsForBounds(INDEX, { minLat: 35.2, maxLat: 35.7, minLon: 139.6, maxLon: 140.1 })
  assert.ok(c.some((t) => t.includes('GEBCO')))
})

test('CREDITS : sur Brest, EMODnet s ajoute avec sa formulation imposee', () => {
  const c = creditsForBounds(INDEX, { minLat: 48.2, maxLat: 48.5, minLon: -4.7, maxLon: -4.3 })
  assert.ok(
    c.includes(
      'This data product was created by EMODnet and is owned by the EU and licensed under CC BY 4.0.'
    ),
    'la formule EMODnet doit etre reprise MOT POUR MOT (CC BY 4.0)'
  )
  assert.ok(c.some((t) => t.includes('GEBCO')), 'GEBCO reste dessous')
})

test('CREDITS : la mention de non-navigation est obligatoire des qu une source marine sert', () => {
  const c = creditsForBounds(INDEX, { minLat: 48.2, maxLat: 48.5, minLon: -4.7, maxLon: -4.3 })
  assert.ok(c.includes('These data are not to be used for navigation.'))
})

test('CREDITS : pas de doublon si deux zones partagent la meme source', () => {
  const idx = normalizeIndex({
    zones: [
      { id: 'fr', source: 'emodnet', zmax: 10, bbox: [-6, 41, 10, 52] },
      { id: 'baltique', source: 'emodnet', zmax: 10, bbox: [9, 53, 30, 66] },
    ],
  })
  const c = creditsForBounds(idx, { minLat: 40, maxLat: 67, minLon: -7, maxLon: 31 })
  const emodnet = c.filter((t) => t.includes('EMODnet'))
  assert.equal(emodnet.length, 1)
})

test('CREDITS : le catalogue porte la formulation exacte de chaque licence', () => {
  // Ce test est un VERROU juridique, pas un test de logique : si quelqu un
  // reformule une de ces phrases, la licence n est plus respectee.
  assert.equal(
    SOURCES.copernicus.credit,
    'Generated using E.U. Copernicus Marine Service Information; https://doi.org/10.48670/mds-00364'
  )
  assert.equal(
    SOURCES.emodnet.credit,
    'This data product was created by EMODnet and is owned by the EU and licensed under CC BY 4.0.'
  )
  assert.equal(SOURCES.gebco.credit, 'GEBCO Compilation Group (2026) GEBCO_2026 Grid (doi:10.5285/4f68d5c7-45eb-f999-e063-7086abc036fa)')
  assert.equal(SOURCES.bluetopo.license, 'CC0-1.0')
  for (const s of Object.values(SOURCES)) {
    assert.ok(s.credit && s.license, `${s.id} doit porter credit ET licence`)
  }
})
