// LE SOCLE SUIT LA DÉCOUPE DANS LA MÊME IMAGE — SOC, 2026-09-05
//
// > **Adrien, 2026-09-05 (vidéo `20260904-2230-56`) :**
// > *« Je ne vois plus de traits de quadtree dans le socle. »*
// > *« Je n'ai pas un bout de terre qui flotte au milieu du socle vide non plus. »*
// > *« Lorsque je passe d'un niveau inférieur à un niveau supérieur, la terre se
// > met immédiatement à la taille du crop, elle n'est pas minuscule avant de
// > charger à la bonne taille. »*
//
// ⚠️ **CE QUE CE FICHIER VERROUILLE, ET POURQUOI IL N'EXISTAIT PAS.**
//
//   · Les parois du crop se bâtissaient sur les hauteurs RÉSERVÉES
//     (`hauteurDessinee` ← `t.heights` ← `gardeHauteurs`), qui n'arrivent
//     qu'après un aller réseau à chaque pose. Pendant ce temps le refus « ne
//     touchait pas aux parois déjà posées » — celles du repère d'AVANT, deux
//     fois plus large — alors que `uCropDemi`, lui, changeait dans la même
//     image. Un relief à la moitié de sa plaque, 30 à 150 images au banc, 6 s
//     dans la vidéo. **Aucun test ne comparait le repère des parois à celui de
//     la découpe** : la suite était verte avec le défaut.
//   · L'effacement latéral des jupes (P14) n'était actif que pour
//     `zoom ≥ ZOOM_SOCLE − 1,5` (CULL) : éteint à z11, les jupes des tuiles
//     traversaient le mur — 15 308 px de traînées au banc, 532 avec
//     l'effacement. **Aucun test ne posait un crop à z11.**
//
// Le harnais est celui de `test/crop-parois.test.js` (P14) : de VRAIS maillages
// de tuile bâtis par `_buildMesh`, la vraie `construireParoisCrop`, sur un globe
// de papier qui porte exactement ce que ces méthodes lisent.
//
// ⛔ **Mutations vérifiées** (une à la fois, `src/` seul) :
//   · `_paroisProvisoires` rend `null` sans bâtir → ② et ④ rougissent ;
//   · `_effacementLateralActif` rend `!!p` (un mur, n'importe lequel) → ④ rougit ;
//   · `hauteurMaillee` lit `a[k]` sans `+ o.x` (le RTC oublié) → ① rougit ;
//   · `reprendre` ne rejoue plus la mer avec la plaque définitive → ⑤ rougit.

import test from 'node:test'
import assert from 'node:assert/strict'
import * as THREE from 'three'

import { Globe } from '../src/globe.js'
import { repereCrop, latLonDeLocal } from '../src/monde/crop-sphere.js'
import { creerVeilleCrop } from '../src/monde/branchement-crop.js'
import { tileToLatLon, R_GLOBE } from '../src/geo.js'

// ══════════ LE BANC : UN CROP DE 3 × 3 TUILES z12, DU RELIEF SYNTHÉTIQUE ══════

const Z = 12
const X = 2679
const Y = 2293
const CENTRE = tileToLatLon(X + 0.5, Y + 0.5, Z)
const REPERE = repereCrop({ centre: CENTRE, zoom: Z })

function surSphere(lat, lon, rayon) {
  const la = (lat * Math.PI) / 180
  const lo = (lon * Math.PI) / 180
  return new THREE.Vector3(rayon * Math.cos(la) * Math.sin(lo), rayon * Math.sin(la), rayon * Math.cos(la) * Math.cos(lo))
}

// un relief DÉTERMINISTE et non trivial : des collines de 200 à 1 400 m, pour
// que « la même hauteur » ne soit pas « zéro partout »
function reliefs(x, y) {
  const h = new Float32Array(256 * 256)
  for (let j = 0; j < 256; j++) {
    for (let i = 0; i < 256; i++) {
      h[j * 256 + i] = 800 + 600 * Math.sin((x * 256 + i) * 0.031) * Math.cos((y * 256 + j) * 0.023)
    }
  }
  return h
}

function tuile(z, x, y) {
  const nw = tileToLatLon(x, y, z)
  const se = tileToLatLon(x + 1, y + 1, z)
  return {
    key: `${z}/${x}/${y}`, z, x, y, state: 'ready',
    heights: reliefs(x, y), size: 256,
    texture: null, mesh: null, lastUsed: 0,
    center: surSphere((nw.lat + se.lat) / 2, (nw.lon + se.lon) / 2, R_GLOBE),
    chord: surSphere(nw.lat, nw.lon, R_GLOBE).distanceTo(surSphere(se.lat, se.lon, R_GLOBE)),
  }
}

/**
 * Le globe de papier : les VRAIES méthodes de paroi et de jupe, un crop posé.
 * `garde` = les clés dont les hauteurs SURVIVENT à `_buildMesh` (le rôle de
 * `gardeHauteurs` dans le vrai globe) ; par défaut aucune — comme à une pose
 * neuve, avant l'aller réseau de la réservation.
 */
function globePapier({ garde = [] } = {}) {
  const g = {
    exaggeration: 2,
    group: new THREE.Group(),
    tiles: new Map(),
    gardeHauteurs: new Set(garde),
    _materialFor: () => new THREE.MeshBasicMaterial(),
    _fondCrop: null,
    _parois: null,
    _baseYCrop: null,
    _retraitBaseCrop: null,
    _plancherJupeCrop: null,
    _retraitJupeCrop: null,
    _paroisVisibles: true,
    _matricesAuto: true,
    _crop: REPERE,
    uniforms: { uCropCoin: { value: 0.08 }, uCropCoinN: { value: 4.4 } },
    _materiauParois: () => new THREE.MeshBasicMaterial(),
    _fabriqueMateriau: null,
  }
  for (const nom of [
    'tuilesAvecHauteurs', 'tuilesAvecMaillage', 'hauteurDessinee', 'hauteurMaillee', '_tuileLaPlusFine',
    '_rayonPlancherCrop', '_retaillerJupe', '_retaillerJupes', '_effacementLateralActif',
    'construireParoisCrop', '_paroisProvisoires', '_poserSolideParois', 'retirerParoisCrop',
  ]) g[nom] = Globe.prototype[nom]
  return g
}

// bâtit le maillage des 3 × 3 tuiles du crop ET d'une tuile de marge autour
// (5 × 5) — la marge de `reserverHauteurs` (`main.js`, `D = 5 / 6`) : sans elle
// les points de l'anneau posés EXACTEMENT sur le bord est/sud du bloc tombent
// à `tx = 1`, hors de toute tuile (`_tuileLaPlusFine` : `tx >= 1`), et la
// couverture n'est pas 1 — un artefact de banc, pas un défaut du produit, où
// les racines z2 couvrent tout
function batirBloc(g) {
  const out = []
  for (let dy = -2; dy <= 2; dy++) {
    for (let dx = -2; dx <= 2; dx++) {
      const t = tuile(Z, X + dx, Y + dy)
      g.tiles.set(t.key, t)
      Globe.prototype._buildMesh.call(g, t)
      out.push(t)
    }
  }
  return out
}

const memeRepere = (r, rep) => r && r.cx === rep.cx && r.cy === rep.cy && r.demi === rep.demi

// ══════════ ① LA HAUTEUR LUE DANS LE MAILLAGE EST CELLE DE LA LOI ═════════════

test('① `hauteurMaillee` rend ce que `hauteurDessinee` rend — la même loi, lue dans le maillage', () => {
  // ⚠️ on GARDE les hauteurs pour que les deux lectures existent sur la même tuile
  const g = globePapier({ garde: [`${Z}/${X}/${Y}`] })
  const t = tuile(Z, X, Y)
  g.tiles.set(t.key, t)
  Globe.prototype._buildMesh.call(g, t)
  assert.ok(t.heights, 'la tuile doit garder ses hauteurs (elle est réservée)')
  assert.ok(t.mesh, 'et porter un maillage')

  let n = 0
  let ecartMax = 0
  // un balayage de la tuile, PAS un point : nœuds ET intérieurs de cellule, où
  // la diagonale de `interpolerMaille` décide
  for (let j = 0; j <= 40; j++) {
    for (let i = 0; i <= 40; i++) {
      const u = 0.02 + (i / 40) * 0.96
      const v = 0.02 + (j / 40) * 0.96
      const { lat, lon } = tileToLatLon(X + u, Y + v, Z)
      const hD = g.hauteurDessinee(lat, lon, [t])
      const hM = g.hauteurMaillee(lat, lon, [t])
      assert.ok(Number.isFinite(hD) && Number.isFinite(hM), `(${u}, ${v}) : ${hD} / ${hM}`)
      ecartMax = Math.max(ecartMax, Math.abs(hD - hM))
      n++
    }
  }
  // la précision est celle du float32 en RTC : 4,8·10⁻⁴ m au pas (parois-crop.js §2),
  // et le relief du banc va de 200 à 1 400 m — un écart d'un mètre serait une autre loi
  assert.ok(n > 1600)
  assert.ok(ecartMax < 0.05, `écart max ${ecartMax} m entre la loi et le maillage`)

  // et un point qu'aucun maillage ne couvre rend `null`, pas zéro (§7 de parois-crop.js)
  const loin = tileToLatLon(X + 5.5, Y + 5.5, Z)
  assert.equal(g.hauteurMaillee(loin.lat, loin.lon, [t]), null)
  assert.equal(g.hauteurMaillee(loin.lat, loin.lon), null)
})

// ══════════ ② LA PLAQUE PROVISOIRE, DANS LE MÊME APPEL QUE LE REFUS ═══════════

test('② sans hauteurs réservées, `construireParoisCrop` REFUSE et pose quand même une plaque provisoire — pour CE repère', () => {
  const g = globePapier() // aucune réservation : `_buildMesh` relâche les hauteurs
  const tuiles = batirBloc(g)
  for (const t of tuiles) assert.equal(t.heights, null, 'le banc doit être celui d’une pose neuve : hauteurs relâchées')
  assert.equal(g.tuilesAvecHauteurs().length, 0)
  assert.equal(g.tuilesAvecMaillage().length, 25)

  const r = g.construireParoisCrop()
  // le refus est RENDU — la reprise rebâtira la définitive
  assert.equal(r.refus, 'couverture', 'sans hauteurs, la paroi définitive refuse')
  assert.equal(r.couverture, 0)
  // et la plaque est LÀ, dans le même appel, sur le repère de la découpe
  assert.equal(r.provisoire, true)
  assert.ok(r.mesh && r.mesh === g._parois, 'la plaque provisoire doit être posée')
  assert.equal(g._parois.userData.provisoire, true)
  assert.ok(memeRepere(g._parois.userData.repere, g._crop), 'la plaque porte le repère de la découpe')
  assert.ok(g.group.children.includes(g._parois), 'et elle est dans le groupe du globe')
  // les quatre grandeurs que la mer et les jupes lisent existent, comme pour la définitive
  assert.ok(Number.isFinite(g._baseYCrop) && g._baseYCrop < 0, `baseY ${g._baseYCrop}`)
  // BIS : biseau éteint (le défaut), le mur est vertical et sa base ne rentre
  // pas — `0`, fini. Il ne vaut `> 0` que l'interrupteur rallumé.
  assert.ok(Number.isFinite(g._retraitBaseCrop) && g._retraitBaseCrop >= 0)
  assert.ok(Number.isFinite(g._plancherJupeCrop))
  assert.ok(Number.isFinite(g._retraitJupeCrop) && g._retraitJupeCrop > 0)
  // et elle a la taille du crop : sa boîte horizontale vaut la largeur du repère
  g._parois.geometry.computeBoundingBox()
  const bb = g._parois.geometry.boundingBox
  const largeur = Math.max(bb.max.x - bb.min.x, bb.max.z - bb.min.z)
  const c = latLonDeLocal(0, 0, REPERE)
  const attendu = 2 * REPERE.demi * 2 * Math.PI * R_GLOBE * Math.cos((c.lat * Math.PI) / 180)
  assert.ok(Math.abs(largeur / attendu - 1) < 0.02, `largeur ${largeur} pour ${attendu} attendus`)
})

// ══════════ ③ PAS DE REBÂTI POUR RIEN, ET LA DÉFINITIVE REMPLACE ══════════════

test('③ une plaque provisoire déjà posée pour CE repère n’est pas rebâtie ; les hauteurs arrivées, la définitive la remplace', () => {
  const g = globePapier()
  const tuiles = batirBloc(g)
  const r1 = g.construireParoisCrop()
  assert.equal(r1.provisoire, true)
  const m1 = g._parois
  // la reprise rappelle sans que rien n'ait changé : le MÊME mesh
  const r2 = g.construireParoisCrop()
  assert.equal(r2.refus, 'couverture')
  assert.equal(r2.provisoire, true)
  assert.equal(g._parois, m1, 'une reprise sans hauteurs ne doit pas rebâtir la plaque provisoire')
  // les hauteurs RÉSERVÉES arrivent
  for (const t of tuiles) t.heights = reliefs(t.x, t.y)
  const r3 = g.construireParoisCrop()
  assert.equal(r3.refus, null, 'avec les hauteurs, la paroi définitive prend')
  assert.equal(r3.provisoire, false)
  assert.notEqual(g._parois, m1, 'la définitive REMPLACE la provisoire')
  assert.equal(g._parois.userData.provisoire, false)
  assert.ok(memeRepere(g._parois.userData.repere, g._crop))
  assert.ok(!g.group.children.includes(m1), 'la provisoire est retirée du groupe')
})

// ══════════ ④ L'EFFACEMENT LATÉRAL SUIT LE MUR ════════════════════════════════

test('④ l’effacement latéral des jupes est actif dès que la plaque (même provisoire) est celle du repère, et éteint quand la découpe change', () => {
  const g = globePapier()
  batirBloc(g)
  assert.equal(g._effacementLateralActif(), false, 'sans mur, rien à effacer')
  g.construireParoisCrop()
  assert.equal(g._effacementLateralActif(), true, 'la plaque provisoire couvre la bande : actif')
  // la jupe d'une tuile de BORD est effacée sur la frontière (le comportement de P14)
  const bord = g.tiles.get(`${Z}/${X + 1}/${Y}`)
  const d = bord.mesh.geometry.userData.jupe
  const a = bord.mesh.geometry.attributes.position.array
  let effacees = 0
  for (let bi = 0; bi < d.bord.length; bi++) {
    const src = d.bord[bi], dst = d.nV + bi
    if (a[dst * 3] === a[src * 3] && a[dst * 3 + 1] === a[src * 3 + 1] && a[dst * 3 + 2] === a[src * 3 + 2]) effacees++
  }
  assert.ok(effacees >= 24, `la tuile de bord doit avoir sa jupe effacée sur la frontière (${effacees})`)
  // une pose neuve : la découpe change, le mur est encore l'ancien → éteint
  g._crop = repereCrop({ centre: CENTRE, zoom: Z + 1 })
  assert.equal(g._effacementLateralActif(), false, 'un mur d’un autre repère ne couvre pas la bande')
  // et la plaque suit dans le même appel : à nouveau actif
  const r = g.construireParoisCrop()
  assert.equal(r.provisoire, true)
  assert.equal(g._effacementLateralActif(), true)
  assert.ok(memeRepere(g._parois.userData.repere, g._crop))
})

// ══════════ ⑤ LA MER SUIT LA PLAQUE DÉFINITIVE ════════════════════════════════

test('⑤ quand la plaque définitive remplace la provisoire, `reprendre` rejoue la mer — une fois', async () => {
  // un globe factice à la manière de `crop-branche.test.js` : la paroi refuse
  // AVEC plaque provisoire pendant deux reprises, puis prend
  let appelsParois = 0
  let appelsMer = 0
  const g = {
    _crop: null,
    poserCrop(a) { g._crop = { cx: 0.5, cy: 0.35, demi: a.tuilesParBloc / 2 / 2 ** a.zoom, zoom: a.zoom }; return g._crop },
    poserFondCrop() { return { refus: null, couverture: 1, bathy: true, profMaxM: 100, rebati: 0 } },
    construireParoisCrop() {
      appelsParois++
      return appelsParois <= 3
        ? { mesh: {}, refus: 'couverture', couverture: 0.5, provisoire: true }
        : { mesh: {}, refus: null, couverture: 1, provisoire: false }
    },
    poserHabillage(a) { return a },
    poserRampe() { return { refus: null, echelle: {} } },
    async poserMer() { appelsMer++; return { portee: 4, couverture: 1 } },
    retirerCrop() { g._crop = null },
  }
  const contexte = () => ({ centre: { lat: 45.9, lon: 6.87 }, zoom: 12, tuilesParBloc: 3, habillage: {}, fond: {}, mer: {} })
  const v = creerVeilleCrop({ globe: g, contexte, periodeReprise: 2 })
  const image = () => v.maj(12_000, 12_000)
  image() // la pose : parois provisoires (1), mer (1)
  assert.equal(appelsParois, 1)
  assert.equal(appelsMer, 1)
  assert.deepEqual(v.refus, ['parois'])
  // deux reprises encore provisoires : la mer n'est PAS rejouée
  for (let i = 0; i < 4; i++) image()
  assert.equal(appelsParois, 3, `reprises : ${appelsParois}`)
  assert.equal(appelsMer, 1, 'tant que la plaque est provisoire, la mer reste sur son fond')
  // la définitive prend : la mer est rejouée UNE fois
  for (let i = 0; i < 2; i++) image()
  assert.equal(appelsParois, 4)
  assert.equal(appelsMer, 2, 'la plaque définitive entraîne la mer')
  assert.deepEqual(v.refus, [])
  // et plus rien ensuite
  for (let i = 0; i < 6; i++) image()
  assert.equal(appelsParois, 4)
  assert.equal(appelsMer, 2)
  await v.enVol()
})
