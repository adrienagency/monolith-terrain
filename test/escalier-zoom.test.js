import test from 'node:test'
import assert from 'node:assert/strict'
import {
  ZOOM_PALIER_MIN,
  bornesEscalier,
  pasEscalier,
  paliersRetenus,
  palierDeClic,
  intersectionGlobe,
  viseeArrivee,
} from '../src/escalier-zoom.js'
import { DIVE_TIERS, stepZoom } from '../src/modes.js'

// ══════════ LE PLANCHER ═════════════════════════════════════════════════════

test('les deux paliers les plus larges n’existent plus', () => {
  // Adrien : « Z1 et Z2 ne doivent pas exister » — son Z1 est notre z4, son Z2
  // notre z5, son Z3 notre z6. Le plancher est donc z6, et rien en dessous
  // n'est atteignable par l'escalier.
  assert.equal(ZOOM_PALIER_MIN, 6)
  assert.equal(pasEscalier(7, -1), 6)
  assert.equal(pasEscalier(6, -1), 6, 'on butte au plancher, on ne descend pas à z5')
  assert.equal(pasEscalier(5, -1), 6, 'un vieux lien à z5 est remonté, pas conservé')
  assert.equal(pasEscalier(4, -1), 6)
})

test('un cran à la fois, dans les deux sens, et l’aller-retour revient au départ', () => {
  for (let z = 6; z < 15; z++) {
    assert.equal(pasEscalier(z, 1, 15), z + 1, `zoom depuis z${z}`)
    assert.equal(pasEscalier(pasEscalier(z, 1, 15), -1, 15), z, `aller-retour depuis z${z}`)
  }
})

test('le plafond reste le zoom fin de l’utilisateur, jamais moins de 12', () => {
  assert.deepEqual(bornesEscalier(15), { min: 6, max: 15 })
  assert.deepEqual(bornesEscalier(17), { min: 6, max: 17 })
  assert.deepEqual(bornesEscalier(9), { min: 6, max: 12 }, 'un zoom fin bas ne rabaisse pas le plafond sous 12')
  assert.deepEqual(bornesEscalier(undefined), { min: 6, max: 12 })
  assert.equal(pasEscalier(15, 1, 15), 15, 'on butte au plafond')
  assert.equal(pasEscalier(17, 1, 17), 17)
})

test('un zoom sous le plancher remonte AU plancher, pas d’un cran', () => {
  // un lien de partage fabriqué avant ce changement porte un z4 ; le premier
  // cran de zoom ne doit pas le poser sur z5, qu'on vient de supprimer
  assert.equal(pasEscalier(4, 1, 15), 6)
  assert.equal(pasEscalier(5, 1, 15), 6)
  assert.equal(pasEscalier(1, 1, 15), 6)
})

test('pasEscalier tient les entrées absurdes', () => {
  assert.equal(pasEscalier(NaN, -1), 6)
  assert.equal(pasEscalier(undefined, 1), 6)
  assert.equal(pasEscalier(10.4, 1, 15), 11, 'un zoom fractionnaire est arrondi avant le pas')
  // un plancher au-dessus du plafond ne doit pas rendre un intervalle vide
  assert.deepEqual(bornesEscalier(12, 20), { min: 20, max: 20 })
})

// ══════════ LES PALIERS DE PLONGÉE ══════════════════════════════════════════

test('les paliers z4 et z5 sont retirés de la table de plongée', () => {
  const gardes = paliersRetenus(DIVE_TIERS)
  assert.ok(gardes.every((p) => p.zoom == null || p.zoom >= 6))
  assert.equal(gardes.find((p) => p.zoom === 4), undefined)
  assert.equal(gardes.find((p) => p.zoom === 5), undefined)
  assert.equal(gardes[0].zoom, null, 'le palier du zoom fin n’a pas de niveau et reste toujours')
  assert.equal(gardes[gardes.length - 1].zoom, 6, 'le plus large qui reste est z6')
})

test('DIVE_TIERS est DÉJÀ amputée — modes.js ne sert plus l’ancien escalier', () => {
  // le filtre ci-dessus est la règle ; ce test vérifie qu'elle a bien été
  // APPLIQUÉE. Sans lui, `paliersRetenus` pourrait être juste et inutilisé.
  assert.deepEqual(DIVE_TIERS, paliersRetenus(DIVE_TIERS))
  assert.equal(DIVE_TIERS.at(-1).zoom, 6)
})

test('le clic depuis l’orbite haute atterrit sur le plus large palier qui reste', () => {
  // au-dessus de tous les paliers (la porte orbitale s'ouvre à 1 600 km), c'est
  // exactement le « j'arrive en Z3 » d'Adrien
  assert.equal(palierDeClic(DIVE_TIERS, 40000000).zoom, 6)
  assert.equal(palierDeClic(DIVE_TIERS, 1600000).zoom, 6, 'pile sur la borne : encore le palier large')
  // plus bas, le palier de l'altitude reprend la main — le réglage à la molette
  // du globe n'est pas perdu. Un palier s'engage SOUS son `altM` : 1 599 999 m
  // est encore du z6, il faut passer sous 600 km pour toucher le z7.
  assert.equal(palierDeClic(DIVE_TIERS, 1599999).zoom, 6)
  assert.equal(palierDeClic(DIVE_TIERS, 599999).zoom, 7)
  assert.equal(palierDeClic(DIVE_TIERS, 150000).zoom, 8)
  assert.equal(palierDeClic(DIVE_TIERS, 30000).zoom, 10)
  assert.equal(palierDeClic(DIVE_TIERS, 5000).zoom, null, 'tout en bas : le zoom fin')
  assert.equal(palierDeClic([], 1000), null)
})

test('stepZoom (modes.js) délègue bien au plancher partagé', () => {
  // stepZoom reste l'API que modes.js et main.js appellent ; elle ne doit plus
  // avoir de plancher à elle
  assert.equal(stepZoom(6, -1), 6)
  assert.equal(stepZoom(5, -1), 6)
  assert.equal(stepZoom(12, -1), 11)
  assert.equal(stepZoom(10, 1, 15), 11)
})

// ══════════ LE CLIC SUR LE GLOBE ════════════════════════════════════════════

test('un rayon qui vise le globe rend le point le PLUS PROCHE, pas l’antipode', () => {
  // caméra à 300 sur +Z, visant l'origine : elle touche le globe en (0, 0, 100)
  const p = intersectionGlobe({ x: 0, y: 0, z: 300 }, { x: 0, y: 0, z: -1 }, 100)
  assert.ok(p)
  assert.equal(Math.round(p.z), 100)
  assert.ok(Math.abs(p.x) < 1e-9 && Math.abs(p.y) < 1e-9)
  // l'antipode (0, 0, -100) existe aussi ; le rendre ferait plonger à l'opposé
  assert.notEqual(Math.round(p.z), -100)
})

test('le point rendu est bien SUR la sphère, sous n’importe quel angle', () => {
  const R = 100
  // ⚠️ les angles restent DANS le disque apparent : à 300 unités, un globe de
  // rayon 100 ne fait que 19,5° de demi-angle. Un rayon plus incliné manque la
  // planète pour de bon — ce n'est pas un défaut, c'est le ciel.
  for (const dir of [
    { x: -0.2, y: -0.1, z: -1 },
    { x: 0.15, y: 0.2, z: -1 },
    { x: 0, y: -0.25, z: -1 },
  ]) {
    const p = intersectionGlobe({ x: 0, y: 0, z: 300 }, dir, R)
    assert.ok(p, 'le rayon doit toucher')
    assert.ok(Math.abs(Math.hypot(p.x, p.y, p.z) - R) < 1e-6, 'rayon exact')
  }
})

test('la direction est normalisée par le module, pas par l’appelant', () => {
  const a = intersectionGlobe({ x: 0, y: 0, z: 300 }, { x: 0, y: 0, z: -1 }, 100)
  const b = intersectionGlobe({ x: 0, y: 0, z: 300 }, { x: 0, y: 0, z: -37 }, 100)
  assert.deepEqual(a, b)
})

test('cliquer à côté de la planète ne plonge nulle part', () => {
  // rayon parallèle qui passe à 200 unités du centre d'un globe de 100
  assert.equal(intersectionGlobe({ x: 200, y: 0, z: 300 }, { x: 0, y: 0, z: -1 }, 100), null)
  // globe DERRIÈRE la caméra
  assert.equal(intersectionGlobe({ x: 0, y: 0, z: 300 }, { x: 0, y: 0, z: 1 }, 100), null)
  assert.equal(intersectionGlobe(null, { x: 0, y: 0, z: -1 }, 100), null)
  assert.equal(intersectionGlobe({ x: 0, y: 0, z: 300 }, { x: 0, y: 0, z: 0 }, 100), null)
  assert.equal(intersectionGlobe({ x: 0, y: 0, z: 300 }, { x: 0, y: 0, z: -1 }, 0), null)
})

test('une caméra à l’intérieur du globe voit quand même la coque', () => {
  const p = intersectionGlobe({ x: 0, y: 0, z: 0 }, { x: 0, y: 1, z: 0 }, 100)
  assert.ok(p)
  assert.equal(Math.round(p.y), 100)
})

// ══════════ « MON POINT RESTE AU CENTRE » ═══════════════════════════════════

test('la caméra vise le lieu demandé, pas le centre géométrique du bloc', () => {
  // le pire cas structurel documenté : une demi-tuile, 9,33 unités sur un socle
  // de 56. La visée doit le suivre, sinon le cran suivant relit le centre snappé.
  assert.deepEqual(viseeArrivee({ x: 9.33, z: -9.33 }, 28), { x: 9.33, z: -9.33 })
  assert.deepEqual(viseeArrivee({ x: 0, z: 0 }, 28), { x: 0, z: 0 })
})

test('la visée ne sort jamais du socle, même sur une entrée aberrante', () => {
  // hors du socle, la caméra viserait le vide et le garde-fou de dégagement au
  // sol échantillonnerait un relief clampé
  assert.deepEqual(viseeArrivee({ x: 400, z: -400 }, 28), { x: 28, z: -28 })
  assert.deepEqual(viseeArrivee({ x: 27, z: 27 }, 28, 2), { x: 26, z: 26 }, 'la marge rentre le point du bord')
})

test('pas de lieu, pas de décentrage — on retombe sur le centre du bloc', () => {
  assert.deepEqual(viseeArrivee(null, 28), { x: 0, z: 0 })
  assert.deepEqual(viseeArrivee({ x: NaN, z: undefined }, 28), { x: 0, z: 0 })
  assert.deepEqual(viseeArrivee({ x: 5, z: 5 }, 0), { x: 0, z: 0 })
})

// ══════════ LA BOUCLE COMPLÈTE ══════════════════════════════════════════════

test('un aller-retour d’escalier ne dérive plus : le centre est un point fixe', () => {
  // ce que faisait l'ancien code, simulé : chaque cran relisait le centre
  // GÉOMÉTRIQUE du bloc, et le calage sur la grille de tuiles y ajoutait son
  // écart. Ici la visée SUIT le lieu demandé, donc la relecture rend le lieu.
  const decalageGrille = { x: 6.29, z: -7.28 } // mesures mont St Helens / La Réunion
  let zoom = 12
  // le lieu voulu, en coordonnées monde : la visée doit le rendre inchangé
  const voulu = { x: decalageGrille.x, z: decalageGrille.z }
  for (let i = 0; i < 8; i++) {
    const visee = viseeArrivee(voulu, 28)
    assert.deepEqual(visee, voulu, `cran ${i} : la visée ne doit rien perdre`)
    zoom = pasEscalier(zoom, -1, 15)
  }
  assert.equal(zoom, 6, 'huit dézooms depuis z12 s’arrêtent net au plancher')
})
