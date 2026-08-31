import { test } from 'node:test'
import assert from 'node:assert/strict'
import * as THREE from 'three'
import { buildFilledRing } from '../src/map/water-layer.js'
import { buildLineSegments } from '../src/map/line-segments.js'
import { poseurPlat } from '../src/monde/sol-globe.js'
import { makeInsideBlock, blockOutline } from '../src/map/block-clip.js'
import { latLonToTile } from '../src/geo.js'

// ══════════ CE QUE PÈSE UN SOMMET DE PLAN D'EAU — Tâche R14 ═════════════════
//
// ⚠️ **LE POSTE DOMINANT DU CALQUE D'EAU EST SON REMPLISSAGE, PAS SES TRAITS.**
// Mesuré dans la page vivante (`scripts/sonde-eau-memoire.mjs`, Chamonix z6,
// mode sphère) : 14,12 Mo de géométrie tenue par le calque, dont **12,64 Mo
// (89 %) dans les deux maillages de remplissage** — 451 485 sommets — contre
// 2,16 Mo pour les 67 630 segments de traits. Le nombre de sommets de
// remplissage est donc CE qui décide de la mémoire du calque, et le nombre
// d'octets par sommet est le seul levier qui ne coûte rien à l'image.
//
// ⛔ **UN ATTRIBUT QUE PERSONNE NE LIT EST DE LA MÉMOIRE PERDUE, PAS UNE
// PRÉCAUTION.** Les deux matériaux de remplissage sont connus et tous deux
// ignorent la normale :
//   · `_fillMaterial` est un `MeshBasicMaterial` — il ne s'éclaire pas ;
//   · `makeLakeMaterial` est un `ShaderMaterial` dont le nuanceur de sommets ne
//     lit que `position`, et dont le fragment se donne une normale EN DUR
//     (`vec3 N = uGlobe > 0.5 ? normalize(vWorldPos) : vec3(0,1,0)` — « flat
//     normal, by design », lake-material.js).
// Un `computeVertexNormals()` remplissait pourtant un attribut `normal` de
// 12 octets par sommet : 5,42 Mo à Chamonix z6, soit 38 % de tout ce que le
// calque tenait.
//
// ⚠️ **CE TEST ÉPINGLE LA LISTE DES ATTRIBUTS, PAS LEUR ABSENCE UN À UN.** Le
// défaut à empêcher n'est pas « la normale revient » mais « un attribut de plus
// arrive sans que personne ne mesure ce qu'il coûte ». Un nouvel attribut fait
// donc échouer ce test : c'est le rendez-vous voulu.

// Un MNT synthétique, comme test/geo.test.js — `latLonToWorld` n'a besoin que
// de ces quatre champs, et le drapage plat rend une hauteur constante.
const t = latLonToTile(45.9766, 7.6585, 12)
const DEM = { zoom: 12, size: 768, originTileX: Math.floor(t.x) - 1, originTileY: Math.floor(t.y) - 1 }
const FP = { half: 28, corner: 0, cornerN: 2, regionOn: false }
const OUTLINE = blockOutline(FP)
const DEDANS = makeInsideBlock(FP)
const POSEUR = poseurPlat(() => 0)

// un carré d'eau bien à l'intérieur du bloc, en lon/lat autour du point du MNT
const carre = (d = 0.01) => ({
  outer: [
    [7.6585 - d, 45.9766 - d], [7.6585 + d, 45.9766 - d],
    [7.6585 + d, 45.9766 + d], [7.6585 - d, 45.9766 + d],
    [7.6585 - d, 45.9766 - d],
  ],
  holes: [],
})

test('un plan d’eau rempli ne porte QUE les attributs qu’un matériau lit', () => {
  const geo = buildFilledRing(carre(), DEM, POSEUR, OUTLINE, FP, DEDANS)
  assert.ok(geo, 'le carré est dans le bloc : il doit produire une géométrie')
  assert.deepEqual(
    Object.keys(geo.attributes).sort(),
    ['position'],
    'aucun des deux matériaux de remplissage ne lit autre chose que position',
  )
})

test('un lac nivelé (flat) ne porte pas plus d’attributs qu’une aire', () => {
  const geo = buildFilledRing(carre(), DEM, POSEUR, OUTLINE, FP, DEDANS, true)
  assert.ok(geo)
  assert.deepEqual(Object.keys(geo.attributes).sort(), ['position'])
})

// Le chiffre qui décide de la mémoire du calque, épinglé comme tel : 12 octets
// de position + 4 octets d'index par sommet. 28 était la valeur d'avant (la
// normale en ajoutait 12) ; à 451 485 sommets, l'écart fait 5,42 Mo.
test('le coût mémoire d’un sommet de remplissage reste borné à 16 octets', () => {
  const geo = buildFilledRing(carre(), DEM, POSEUR, OUTLINE, FP, DEDANS)
  const sommets = geo.attributes.position.count
  // TOUS les attributs, pas seulement ceux qu'on espère y trouver : compter
  // `position` et l'index revient à mesurer ce qu'on a voulu écrire au lieu de
  // ce que la géométrie porte vraiment.
  let octets = geo.index ? geo.index.array.byteLength : 0
  for (const nom of Object.keys(geo.attributes)) octets += geo.attributes[nom].array.byteLength
  assert.ok(sommets > 0)
  assert.ok(
    octets / sommets <= 16,
    `${(octets / sommets).toFixed(1)} octets par sommet — au-dessus des 16 attendus (position + index)`,
  )
})

// Garde-fou de l'optimisation elle-même : retirer un attribut ne doit pas
// retirer la géométrie. Le remplissage doit rester un maillage indexé complet.
test('retirer la normale ne retire pas le maillage', () => {
  const geo = buildFilledRing(carre(), DEM, POSEUR, OUTLINE, FP, DEDANS)
  assert.ok(geo.attributes.position.count >= 3, 'des sommets')
  assert.ok(geo.index && geo.index.count >= 3 && geo.index.count % 3 === 0, 'des triangles entiers')
})

// ══════════ LE MÊME DÉFAUT, DANS LES TRAITS — Tâche R14 ═════════════════════
//
// La même lecture (`scripts/sonde-eau-attributs.mjs`, page vivante) montre les
// programmes de `LineMaterial` réclamer `instanceEnd, instanceStart, position,
// uv` — et RIEN d'autre — pendant que la géométrie portait en plus
// `instanceDistanceStart` et `instanceDistanceEnd`, posés par un
// `computeLineDistances()`. `LineMaterial` ne lit ces deux-là que sous
// `USE_DASH`, et **aucun trait du site n'est pointillé** : `dashed` n'est écrit
// nulle part dans `src/`.
//
// Ce que ça coûtait : 8 octets par segment, soit 0,52 Mo pour les 67 630
// segments relevés à Chamonix z6 — 5,8 % de ce que le calque tient une fois la
// normale retirée. Le rapport de mesure vit dans `.banc/R14/`.
test('un lot de traits ne porte pas les longueurs d’un pointillé qui n’existe pas', () => {
  const runs = [[{ x: -5, z: -5 }, { x: 0, z: 0 }, { x: 5, z: 4 }]]
  const g = buildLineSegments(runs, POSEUR, { color: '#2b7fc4', widthPx: 1.4, offset: 0.07, renderOrder: 18, resolution: new THREE.Vector2(1280, 800) })
  const lot = g.children[0]
  assert.ok(lot, 'un lot de segments')
  assert.equal(lot.geometry.attributes.instanceStart.count, 2, 'trois points font deux segments')
  assert.deepEqual(
    Object.keys(lot.geometry.attributes).sort(),
    ['instanceEnd', 'instanceStart', 'position', 'uv'],
    'exactement ce que le programme de LineMaterial réclame, pas un attribut de plus',
  )
})
