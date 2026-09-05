// ══════════ TRO — LA GRILLE DES NŒUDS, ET LES TUILES REBÂTIES SANS HAUTEURS ═══
//
// > **Adrien, 2026-09-05 :** *« encore de très nombreux bugs du quadtree
// > maritime, avec des trous (vidéo 2) »* — `q_038` : des rectangles ROUGES au
// > milieu de la mer du crop, et la nappe en marches d'escalier.
//
// MESURÉ (`scripts/sonde-tro.mjs`, La Réunion, crop z12 cadré de trois quarts,
// au repos, 36 tuiles dessinées, 0 trou de couverture) : **12 tuiles bâties sur
// un AUTRE fond que celui posé, dont 4 avec la mer à 0 m** là où le champ dit
// −1 320 à −1 718 m. Elles avaient été bâties pendant la descente, avant le
// fond, et `_refaireMaillagesDuFond` exigeait `t.heights` — relâché dès le
// maillage pour toute tuile hors `gardeHauteurs`, c'est-à-dire pour TOUTES
// celles que le crop dessine (réservation au zoom du socle, dessin un ou deux
// niveaux plus fin). Le plateau à 0 m fait une marche de 1,5 km × exagération,
// et sa jupe vue de trois quarts est le rectangle rouge.
//
// LE CORRECTIF : `_buildMesh` retient les (G+1)² hauteurs échantillonnées aux
// nœuds (`t.grille`, 5 Kio), tout ce qu'il lit de `t.heights` ; sans hauteurs,
// il rebâtit depuis la grille, AU BIT. `_refaireMaillagesDuFond` rebâtit alors
// toute tuile de la calotte, réservée ou non.
//
// ⚠️ **CHAQUE TEST EST UNE MUTATION QUI A ÉTÉ JOUÉE** : ① rouge si la grille ne
// remplace pas les hauteurs au bit ; ② rouge si `_refaireMaillagesDuFond`
// retrouve `!t.heights → continue` ; ③ rouge si `_rechargeTuiles` laisse une
// grille périmée ; ④ rouge si la grille n'est pas recalculée des hauteurs neuves ;
// et ① est aussi rouge si `posAt` relit `sampleHeights` sur des hauteurs absentes
// (mutation `t.heights || zéros` : la terre de la tuile s'aplatit).

import { test } from 'node:test'
import assert from 'node:assert/strict'
import * as THREE from 'three'
import { Globe, sampleHeights, echantillonnerGrille } from '../src/globe.js'
import { R_GLOBE, EARTH_RADIUS_M, latLonToTile, tileToLatLon, latLonToSphere } from '../src/geo.js'
import { repereCrop } from '../src/monde/crop-sphere.js'
import { segmentsTuile } from '../src/monde/maillage-tuile.js'

const EXAGERATION = 2
const CENTRE = { lat: -21.248422235627014, lon: 55.7666015625 }
const REPERE = repereCrop({ centre: CENTRE, zoom: 12 })

// des hauteurs NON uniformes, terre ET mer mêlées : une grille uniforme cacherait
// une transposition, et une tuile toute en mer cacherait une grille ignorée (avec
// un fond, la mer prend le champ quelle que soit la hauteur de tuile — la TERRE
// seule prouve que `posAt` lit bien la grille : mutation jouée, voir l'en-tête)
function hauteursVallonnees(size = 256) {
  const h = new Float32Array(size * size)
  for (let j = 0; j < size; j++) for (let i = 0; i < size; i++) h[j * size + i] = 400 + 400 * Math.sin(i / 17) + 300 * Math.cos(j / 23)
  return h
}

function tuileDeTest(z, lat, lon, heights) {
  const brut = latLonToTile(lat, lon, z)
  const x = Math.floor(brut.x)
  const y = Math.floor(brut.y)
  const nw = tileToLatLon(x, y, z)
  const se = tileToLatLon(x + 1, y + 1, z)
  return {
    key: `${z}/${x}/${y}`, z, x, y, state: 'ready', heights, size: 256,
    texture: null, mesh: null, lastUsed: 0,
    center: latLonToSphere((nw.lat + se.lat) / 2, (nw.lon + se.lon) / 2),
    chord: latLonToSphere(nw.lat, nw.lon).distanceTo(latLonToSphere(se.lat, se.lon)),
  }
}

function fondConstant(profondeur, repere = REPERE) {
  const cote = 5
  return { valeurs: new Float32Array(cote * cote).fill(profondeur), cote, repere, portee: 3, bathy: true, profMaxM: -profondeur }
}

function globeNu({ crop = null, fond = null } = {}) {
  return {
    uniforms: { uCropOn: { value: crop ? 1 : 0 }, uFondChamp: { value: null }, uFondOn: { value: 0 }, uFondPortee: { value: 3 }, uFondMetres: { value: 1 }, uFondPasQ: { value: 0 } },
    exaggeration: EXAGERATION,
    _crop: crop, _fondCrop: fond, _cleFondPosee: '',
    tiles: new Map(), group: new THREE.Group(), gardeHauteurs: new Set(),
    _materialFor: () => new THREE.MeshBasicMaterial(),
    _parois: null, _baseYCrop: null,
    _rayonPlancherCrop(t) { return Globe.prototype._rayonPlancherCrop.call(this, t) },
    _retaillerJupe(t) { return Globe.prototype._retaillerJupe.call(this, t) },
    _buildMesh(t) { return Globe.prototype._buildMesh.call(this, t) },
    _refaireMaillagesDuFond() { return Globe.prototype._refaireMaillagesDuFond.call(this) },
    _poserTextureFond(f) { return Globe.prototype._poserTextureFond.call(this, f) },
  }
}

const positionsDe = (mesh) => Float32Array.from(mesh.geometry.attributes.position.array)
const rayonDuSommet = (mesh, s) => { const p = mesh.geometry.attributes.position; return new THREE.Vector3(p.getX(s), p.getY(s), p.getZ(s)).add(mesh.position).length() }

test('① la grille remplace les hauteurs AU BIT : même maillage avec et sans `t.heights`', () => {
  const g = globeNu({ crop: REPERE, fond: fondConstant(-1500) })
  const t = tuileDeTest(12, CENTRE.lat, CENTRE.lon, hauteursVallonnees())
  g.gardeHauteurs.add(t.key) // réservée : ses hauteurs survivent au premier maillage, pour la comparaison
  g._buildMesh(t)
  assert.ok(t.grille instanceof Float64Array, 'la grille est retenue sur la tuile')
  const G = segmentsTuile(12)
  assert.equal(t.grille.length, (G + 1) * (G + 1))
  // la grille EST `sampleHeights` aux fractions i/G — pas une transposée, pas un arrondi
  for (const [i, j] of [[0, 0], [G, 0], [3, 17], [G / 2, G / 2], [G, G]]) {
    assert.equal(t.grille[j * (G + 1) + i], sampleHeights(t.heights, i / G, j / G, 256))
  }
  const avecHauteurs = positionsDe(t.mesh)
  const origine = t.mesh.position.clone()
  // les hauteurs partent (c'est ce que fait `_buildMesh` pour toute tuile non réservée)
  g.gardeHauteurs.delete(t.key)
  t.heights = null
  g.group.remove(t.mesh); t.mesh = null
  g._buildMesh(t)
  const sansHauteurs = positionsDe(t.mesh)
  assert.deepEqual(sansHauteurs, avecHauteurs, 'rebâti depuis la grille, le maillage doit être identique au bit')
  assert.ok(t.mesh.position.equals(origine))
})

test('① bis sans hauteurs NI grille, `_buildMesh` refuse plutôt que d’inventer un relief', () => {
  const g = globeNu()
  const t = tuileDeTest(12, CENTRE.lat, CENTRE.lon, null)
  assert.throws(() => g._buildMesh(t), /ni hauteurs ni grille/)
})

test('② `_refaireMaillagesDuFond` rebâtit une tuile SANS hauteurs — le défaut de La Réunion', () => {
  const g = globeNu({ crop: REPERE })
  const t = tuileDeTest(12, CENTRE.lat, CENTRE.lon, new Float32Array(256 * 256)) // la mer du terrarium : 0 m
  g.tiles.set(t.key, t)
  g._buildMesh(t)
  // ⚠️ PAS de `gardeHauteurs` : c'est le cas des tuiles que le crop dessine
  t.heights = null
  assert.ok(Math.abs(rayonDuSommet(t.mesh, 312) - R_GLOBE) < 1e-4, 'bâtie sans fond, la mer est sur la sphère')
  const r = Globe.prototype.poserFondCrop.call(g, { remplir: (emprise, n, sortie) => { sortie.fill(-1500); return { remplis: sortie.length, manquants: 0, bathy: true, sortie } } })
  assert.equal(r.refus, null)
  assert.equal(r.rebati, 1, 'la tuile sans hauteurs DOIT être rebâtie sur le fond — c’était le plateau à 0 m')
  const echelle = (R_GLOBE / EARTH_RADIUS_M) * EXAGERATION
  const lu = rayonDuSommet(t.mesh, 312)
  assert.ok(Math.abs(lu - (R_GLOBE - 1500 * echelle)) < 1e-4, `la mer doit descendre au champ ; elle est à ${lu}`)
  assert.equal(t.mesh.userData.fondCle, g._cleFondPosee, 'le maillage porte la clé du fond qui l’a bâti')
  // et un second `poserFondCrop` sur la même clé ne rebâtit personne (le coût de la reprise)
  const r2 = Globe.prototype.poserFondCrop.call(g, { remplir: (emprise, n, sortie) => { sortie.fill(-1500); return { remplis: sortie.length, manquants: 0, bathy: true, sortie } } })
  assert.equal(r2.rebati, 0)
})

test('② bis hors de la calotte et sans fond d’avant, une tuile n’est PAS rebâtie ; avec un fond d’avant, elle l’est', () => {
  const g = globeNu({ crop: REPERE })
  // une tuile à 3° de là : hors de la calotte (portée 3 × demi-crop z12 ≈ 0,26°)
  const loin = tuileDeTest(12, CENTRE.lat + 3, CENTRE.lon + 3, new Float32Array(256 * 256))
  g.tiles.set(loin.key, loin)
  g._buildMesh(loin)
  loin.heights = null
  const remplir = (emprise, n, sortie) => { sortie.fill(-1500); return { remplis: sortie.length, manquants: 0, bathy: true, sortie } }
  assert.equal(Globe.prototype.poserFondCrop.call(g, { remplir }).rebati, 0, 'hors calotte, rien ne changerait : pas de reconstruction')
  // on lui fait porter un fond d'avant : au retrait du fond, elle doit être rendue à la sphère
  loin.mesh.userData.fondCle = 'un-fond-d-avant'
  assert.equal(Globe.prototype.retirerFondCrop.call(g), 1, 'une tuile qui porte un fond d’avant est rebâtie, même hors calotte')
  assert.equal(loin.mesh.userData.fondCle, '')
})

test('③ `_rechargeTuiles` jette la grille avec les hauteurs — pas de relief périmé', () => {
  const g = globeNu()
  const t = tuileDeTest(12, CENTRE.lat, CENTRE.lon, hauteursVallonnees())
  g.tiles.set(t.key, t)
  g._buildMesh(t)
  assert.ok(t.grille)
  // le corps de `_rechargeTuiles`, lu dans la source : la grille tombe avec `heights`
  const src = Globe.prototype._rechargeTuiles.toString()
  assert.match(src, /t\.heights = null\s*\n\s*t\.grille = null/, '`_rechargeTuiles` doit remettre `t.grille` à null juste après `t.heights`')
})

test('④ des hauteurs NEUVES priment sur une grille retenue', () => {
  const g = globeNu()
  const t = tuileDeTest(12, CENTRE.lat, CENTRE.lon, hauteursVallonnees())
  g._buildMesh(t)
  const ancienne = t.grille
  // une tuile rechargée sur place arrive avec d'autres hauteurs
  t.heights = new Float32Array(256 * 256).fill(250)
  g.group.remove(t.mesh); t.mesh = null
  g._buildMesh(t)
  assert.notEqual(t.grille, ancienne, 'la grille doit être recalculée des hauteurs neuves')
  assert.equal(t.grille[0], 250)
  const echelle = (R_GLOBE / EARTH_RADIUS_M) * EXAGERATION
  assert.ok(Math.abs(rayonDuSommet(t.mesh, 312) - (R_GLOBE + 250 * echelle)) < 1e-4)
})

test('⑤ `echantillonnerGrille` : (G+1)², ligne 0 = nord, doubles', () => {
  const h = hauteursVallonnees()
  const G = 24
  const grille = echantillonnerGrille(h, G, 256)
  assert.equal(grille.length, 625)
  assert.equal(grille[0], sampleHeights(h, 0, 0, 256))
  assert.equal(grille[24], sampleHeights(h, 1, 0, 256))
  assert.equal(grille[600], sampleHeights(h, 0, 1, 256))
  assert.ok(grille instanceof Float64Array)
})
