// LE LIEU CHERCHÉ DOIT TOMBER AU CENTRE — et pourquoi ça ne coûte rien.
//
// Adrien, après avoir cherché le mont St Helens en mode continu : « j'arrive
// bien sur la zone, mais le point recherché doit se trouver au centre de la
// zone qui s'affiche, aussi bien en vertical qu'en horizontal. Ce n'est pas le
// cas actuellement. »
//
// LA CAUSE est dans `loadDem` (dem.js:238-241) et elle est structurelle : le
// bloc est calé sur la GRILLE DE TUILES, par deux `Math.floor`. Le lieu demandé
// tombe donc quelque part DANS la tuile centrale, jamais en son centre — d'où
// un décalage qui va jusqu'à une demi-tuile dans chaque axe.
//
// LA SOLUTION EXISTAIT DÉJÀ, et c'est la raison d'être du mode continu :
// l'emprise reste alignée sur la grille, mais la FENÊTRE DE LECTURE glisse
// dedans. Il suffit de la poser au décalage qui centre le lieu, au lieu de la
// laisser à (0, 0). Aucun chargement de plus : la donnée est déjà là.
//
// ⚠️ ET C'EST EXACTEMENT LA FAMILLE D'ERREUR QUI A COÛTÉ TROIS FOIS SUR CETTE
// BRANCHE : une longueur qui oublie que l'emprise TRIPLE le bloc. C'est
// pourquoi les tests d'ici ne vérifient pas une formule, mais un ALLER-RETOUR
// géographique : `latLonToWorld` puis `worldToLatLon`. Un `TERRAIN_SIZE` glissé
// à la place de `demSpan` fait rater le lieu d'un facteur 3 et l'aller-retour
// le dit tout de suite, en degrés.

import test from 'node:test'
import assert from 'node:assert/strict'
import { latLonToWorld, worldToLatLon, demSpan } from '../src/geo.js'
import { TERRAIN_SIZE } from '../src/terrain.js'
import { COURSE_ELASTIQUE, fenetreQuiCentre } from '../src/fenetre-course.js'

// ──────────────────────────────────────────────────────────────────────────────
// Le décor : un MNT de la forme exacte que rend `recollerEmprise`, construit
// autour d'un lieu réel. La formule de calage sur la grille est celle de
// `loadDem` (dem.js:238-241) — recopiée ICI, dans le décor, jamais dans une
// assertion : c'est le fixture, pas le sujet.
const TUILES_PAR_BLOC = 3

function empriseAutourDe(lat, lon, zoom, { cote = 3, tilePx = 512 } = {}) {
  const n = 2 ** zoom
  const latRad = (lat * Math.PI) / 180
  const cx = Math.floor(((lon + 180) / 360) * n)
  const cy = Math.floor(((1 - Math.log(Math.tan(latRad) + 1 / Math.cos(latRad)) / Math.PI) / 2) * n)
  // le coin haut-gauche du BLOC central, puis, en emprise, un bloc de plus
  const debordBlocs = cote > 1 ? TUILES_PAR_BLOC : 0
  return {
    size: TUILES_PAR_BLOC * tilePx * cote,
    tilePx,
    zoom,
    originTileX: cx - 1 - debordBlocs,
    originTileY: cy - 1 - debordBlocs,
    ...(cote > 1 ? { empriseCote: cote } : {}),
  }
}

// Les zones de référence d'Adrien, plus un contrôle au bord d'une tuile.
const ST_HELENS = { lat: 46.2, lon: -122.19, zoom: 13, nom: 'mont St Helens' }
const CHAMONIX = { lat: 45.92, lon: 6.87, zoom: 12, nom: 'Chamonix' }
const REUNION = { lat: -21.13, lon: 55.53, zoom: 13, nom: 'La Réunion' }

// ══════════ LA RÈGLE PURE ════════════════════════════════════════════════════

test('fenetreQuiCentre : dans la course, le décalage EST la coordonnée du point', () => {
  // Poser la fenêtre à la coordonnée de champ du lieu, c'est demander à la
  // géométrie de lire le champ À CET ENDROIT en son centre. Rien de plus.
  assert.deepEqual(fenetreQuiCentre({ x: 12.5, z: -7.25 }, COURSE_ELASTIQUE), { x: 12.5, z: -7.25 })
  assert.deepEqual(fenetreQuiCentre({ x: 0, z: 0 }, COURSE_ELASTIQUE), { x: 0, z: 0 })
})

test('fenetreQuiCentre : au-delà de la course, on approche au plus près sans casser la borne', () => {
  // Un lieu proche du bord de l'emprise ne PEUT PAS être centré : le socle
  // sortirait du champ et `sampleDem` clamperait, montrant des traînées de
  // relief étiré. On va au bord, pas au-delà — la borne est celle du geste.
  const loin = fenetreQuiCentre({ x: 400, z: -900 }, COURSE_ELASTIQUE)
  assert.equal(loin.x, COURSE_ELASTIQUE)
  assert.equal(loin.z, -COURSE_ELASTIQUE)
  assert.equal(fenetreQuiCentre({ x: COURSE_ELASTIQUE, z: 0 }, COURSE_ELASTIQUE).x, COURSE_ELASTIQUE)
})

test('fenetreQuiCentre : une cible cassée rend le centre, jamais un NaN', () => {
  // Un NaN écrit dans `terrain.fenetre` ne se plaint pas : il rend le socle
  // NOIR à l'image suivante, sans une ligne de console.
  for (const casse of [null, undefined, {}, { x: NaN, z: 3 }, { x: Infinity, z: 'a' }]) {
    const f = fenetreQuiCentre(casse, COURSE_ELASTIQUE)
    assert.ok(Number.isFinite(f.x) && Number.isFinite(f.z), `${JSON.stringify(casse)} → ${JSON.stringify(f)}`)
  }
  assert.deepEqual(fenetreQuiCentre(null, COURSE_ELASTIQUE), { x: 0, z: 0 })
})

// ══════════ L'ALLER-RETOUR GÉOGRAPHIQUE — LE TEST QUI COMPTE ═════════════════

for (const zone of [ST_HELENS, CHAMONIX, REUNION]) {
  test(`le lieu cherché retombe AU CENTRE du socle — ${zone.nom}`, () => {
    const dem = empriseAutourDe(zone.lat, zone.lon, zone.zoom)
    const fen = fenetreQuiCentre(latLonToWorld(dem, zone.lat, zone.lon), COURSE_ELASTIQUE)
    // Le centre du socle affiché est la géométrie (0, 0) ; ce qu'elle LIT dans
    // le champ, c'est (0 + fen.x, 0 + fen.z) — la formule de `_makeDemSampler`.
    const vu = worldToLatLon(dem, fen.x, fen.z)
    // Un pixel de MNT vaut ~14 m à z13, soit ~1,3e-4 degré. On exige mieux que
    // le dix-millième de degré : c'est du même ordre que la précision de la
    // saisie, et très en dessous de ce que l'œil distingue sur un socle.
    assert.ok(Math.abs(vu.lat - zone.lat) < 1e-4, `lat vue ${vu.lat} contre ${zone.lat}`)
    assert.ok(Math.abs(vu.lon - zone.lon) < 1e-4, `lon vue ${vu.lon} contre ${zone.lon}`)
  })
}

test('sans centrage, le lieu tombe jusqu’à une demi-tuile à côté — le défaut mesuré', () => {
  // Le témoin. Sans lui on ne saurait pas si le test ci-dessus prouve quelque
  // chose ou s'il passerait aussi sans rien faire.
  const dem = empriseAutourDe(ST_HELENS.lat, ST_HELENS.lon, ST_HELENS.zoom)
  const p = latLonToWorld(dem, ST_HELENS.lat, ST_HELENS.lon)
  const ecart = Math.hypot(p.x, p.z)
  assert.ok(ecart > 1, `le défaut doit être RÉEL pour que sa correction compte (écart ${ecart.toFixed(2)} u)`)
  // Une tuile fait `demSpan / (size / tilePx)` unités ; la demi-tuile est le
  // pire cas structurel du calage sur la grille.
  const demiTuile = demSpan(dem) / (dem.size / dem.tilePx) / 2
  assert.ok(Math.abs(p.x) <= demiTuile + 1e-9, `x ${p.x} dépasse la demi-tuile ${demiTuile}`)
  assert.ok(Math.abs(p.z) <= demiTuile + 1e-9, `z ${p.z} dépasse la demi-tuile ${demiTuile}`)
})

test('le décalage à rattraper tient TOUJOURS dans la course — le centrage est exact, jamais borné', () => {
  // La borne existe pour les cas généraux (un lien, un GPX cadré large). Pour
  // une recherche, elle ne doit JAMAIS mordre : si elle mordait, le lieu
  // n'arriverait pas au centre et le correctif serait un demi-correctif.
  // Balayage sur toute la plage de latitudes utiles et tous les zooms servis.
  for (let zoom = 4; zoom <= 15; zoom++) {
    for (let lat = -70; lat <= 70; lat += 7.3) {
      for (let lon = -179; lon <= 179; lon += 37.1) {
        const dem = empriseAutourDe(lat, lon, zoom)
        const p = latLonToWorld(dem, lat, lon)
        assert.ok(
          Math.abs(p.x) < COURSE_ELASTIQUE && Math.abs(p.z) < COURSE_ELASTIQUE,
          `z${zoom} ${lat.toFixed(1)}/${lon.toFixed(1)} → (${p.x.toFixed(2)}, ${p.z.toFixed(2)}) hors course`
        )
      }
    }
  }
})

// ══════════ LE PIÈGE DU FACTEUR 3, PRIS DE FACE ══════════════════════════════

test('l’emprise TRIPLE le champ mais PAS le décalage à rattraper — même bloc, même lieu', () => {
  // ⚠️ L'erreur qui s'est glissée trois fois sur cette branche : une longueur
  // qui oublie que l'emprise triple le bloc. Ici elle donnerait un décalage
  // trois fois trop petit (le lieu resterait à un tiers du chemin) ou trois
  // fois trop grand (il sortirait par l'autre bord).
  //
  // La vérité géométrique : le décalage sub-tuile ne dépend QUE de la tuile,
  // et une tuile mesure le même nombre d'unités monde dans les deux cas —
  // 168/9 = 56/3. Bloc simple et emprise 3×3 doivent donc rendre le MÊME
  // décalage, au bit près.
  for (const zone of [ST_HELENS, CHAMONIX, REUNION]) {
    const bloc = empriseAutourDe(zone.lat, zone.lon, zone.zoom, { cote: 1 })
    const emprise = empriseAutourDe(zone.lat, zone.lon, zone.zoom, { cote: 3 })
    assert.equal(demSpan(bloc), TERRAIN_SIZE)
    assert.equal(demSpan(emprise), TERRAIN_SIZE * 3)
    const pb = latLonToWorld(bloc, zone.lat, zone.lon)
    const pe = latLonToWorld(emprise, zone.lat, zone.lon)
    assert.ok(Math.abs(pb.x - pe.x) < 1e-9, `${zone.nom} : x ${pb.x} contre ${pe.x}`)
    assert.ok(Math.abs(pb.z - pe.z) < 1e-9, `${zone.nom} : z ${pb.z} contre ${pe.z}`)
  }
})

// ══════════ LE CONTRÔLE AU BORD D'UNE TUILE ══════════════════════════════════

test('un lieu posé PILE au bord d’une tuile est centré comme les autres', () => {
  // Adrien a demandé « un contrôle sur une zone où le lieu tombe près du bord
  // d'une tuile ». C'est là que le `Math.floor` bascule d'une tuile à l'autre :
  // le décalage passe de +demi-tuile à −demi-tuile. Les deux doivent marcher.
  const zoom = 13
  const n = 2 ** zoom
  // une longitude qui tombe à un cheveu de la frontière de tuile, des deux côtés
  const lonFrontiere = (1234 / n) * 360 - 180
  for (const eps of [-1e-7, 1e-7, -1e-4, 1e-4]) {
    const lon = lonFrontiere + eps
    const dem = empriseAutourDe(46.2, lon, zoom)
    const fen = fenetreQuiCentre(latLonToWorld(dem, 46.2, lon), COURSE_ELASTIQUE)
    const vu = worldToLatLon(dem, fen.x, fen.z)
    assert.ok(Math.abs(vu.lon - lon) < 1e-4, `eps ${eps} : lon vue ${vu.lon} contre ${lon}`)
    assert.ok(Math.abs(vu.lat - 46.2) < 1e-4, `eps ${eps} : lat vue ${vu.lat}`)
  }
})
