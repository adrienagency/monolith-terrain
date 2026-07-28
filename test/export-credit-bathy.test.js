import { test } from 'node:test'
import assert from 'node:assert/strict'
import { EXPORT_CREDIT, creditFor } from '../src/export.js'
import { creditsForBounds, normalizeIndex, NO_NAVIGATION } from '../src/bathy-sources.js'

// L'ATTRIBUTION DES SOURCES BATHYMÉTRIQUES EST UNE OBLIGATION DE LICENCE, pas
// une politesse. EMODnet (CC BY 4.0) et Copernicus imposent une formulation MOT
// POUR MOT ; GEBCO exige sa citation avec DOI. Et elle dépend de l'EMPRISE :
// citer EMODnet sur une carte du Japon serait faux, l'omettre sur une carte de
// Brest serait une violation.
//
// Ces tests verrouillent les deux sens. S'ils tombent, ce n'est pas un détail
// d'affichage — c'est le droit de vendre les exports qui tombe avec.

const BREST = { minLat: 48.2, maxLat: 48.5, minLon: -4.7, maxLon: -4.3 }
const TOKYO = { minLat: 35.3, maxLat: 35.7, minLon: 139.6, maxLon: 140.0 }

// l'index tel que le produit build-bathy-index : la France couverte par EMODnet
// ⚠️ La forme est celle de scripts/bathy-zones.json : `bbox` en
// [ouest, sud, est, nord], PAS des champs min/max séparés. Écrit autrement,
// normalizeIndex jette la zone en silence et l'attribution disparaît — ce test
// est né en attrapant exactement cette erreur.
const INDEX = normalizeIndex({
  base: { source: 'gebco', zmax: 8 },
  zones: [{ id: 'fr-metro', source: 'emodnet', zmax: 10, bbox: [-6, 41, 10, 52] }],
})

test('une zone mal formée est ignorée, elle ne casse pas la carte', () => {
  const bancal = normalizeIndex({ zones: [{ source: 'emodnet', zmax: 10, minLat: 41, maxLat: 52 }] })
  assert.equal(bancal.zones.length, 0, 'sans bbox valide, la zone est jetée')
  assert.equal(bancal.base.zmax, 8, 'et le socle GEBCO reste servi partout')
})

test('sur Brest, la ligne d’export porte l’attribution EMODnet imposée', () => {
  const ligne = creditFor(INDEX, BREST, creditsForBounds)
  assert.ok(ligne.includes('EMODnet'), `EMODnet absent : « ${ligne} »`)
  assert.ok(
    ligne.includes('This data product was created by EMODnet and is owned by the EU and licensed under CC BY 4.0.'),
    'la formulation CC BY 4.0 est imposée MOT POUR MOT, elle ne se paraphrase pas',
  )
})

test('hors zone fine, on ne cite pas une source qui n’a rien fourni', () => {
  const ligne = creditFor(INDEX, TOKYO, creditsForBounds)
  assert.ok(!ligne.includes('EMODnet'), `EMODnet cité à tort au Japon : « ${ligne} »`)
})

test('la mention « pas pour la navigation » suit toujours', () => {
  for (const emprise of [BREST, TOKYO]) {
    assert.ok(creditFor(INDEX, emprise, creditsForBounds).includes(NO_NAVIGATION))
  }
})

test('la ligne de base survit intacte — ODbL, Mapterhorn, GEBCO', () => {
  const ligne = creditFor(INDEX, BREST, creditsForBounds)
  assert.ok(ligne.startsWith(EXPORT_CREDIT), 'la ligne historique reste en tête')
  for (const du of ['OpenStreetMap', 'Mapterhorn', 'GEBCO']) {
    assert.ok(ligne.includes(du), `${du} a disparu de la ligne`)
  }
})

test('sans index, on retombe sur la ligne d’avant plus la mention de navigation', () => {
  const ligne = creditFor(normalizeIndex(null), BREST, creditsForBounds)
  assert.ok(!ligne.includes('EMODnet'))
  assert.ok(ligne.startsWith(EXPORT_CREDIT))
})
