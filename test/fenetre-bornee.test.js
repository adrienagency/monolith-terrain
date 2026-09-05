// LA FENÊTRE BORNÉE — Tâche 6 du plan « globe continu »
// (`docs/superpowers/plans/2026-08-08-globe-continu.md`).
//
// ══════════ CE QUE CE FICHIER GARDE ════════════════════════════════════════
//
//   ① LA COQUE — construite puis auditée par `auditerSolide` : fermée,
//      orientée, sans dégénéré ni NaN, et de volume EXACT à hauteurs nulles ;
//   ② ⚠️ **LES DEUX ASSERTIONS QUI MORDENT** — sans elles ce fichier auditerait
//      cent PAVÉS DROITS. `construireFenetre` seule rend une boîte fermée et
//      orientée par construction : (a) `hauteurs.distinctes > 2`, et (b) la
//      hauteur relevée en un point connu vaut celle du relief bouchonné ;
//   ③ `majHauteurs` — **sans reconstruire la géométrie** : mêmes tampons, mêmes
//      indices, mêmes `x`/`z`, seuls les `y` changent. C'est toute sa raison
//      d'être, et c'est ce qui remplace le cran ;
//   ④ LES DEUX PIÈGES DE L'EMPRISE — l'antiméridien (`ouest > est`, LÉGAL) et
//      l'écrêtage au-delà de 85,051° ;
//   ⑤ CENT EMPRISES tirées au hasard, dont les deux pièges, auditées cent fois,
//      **plus la non-vacuité** de la Tâche 5 ;
//   ⑥ LES MUTATIONS — dalle retournée, mur manquant, nappe absente ; **et ce
//      que l'audit NE VOIT PAS**, écrit noir sur blanc avec sa mesure : un
//      anneau décalé d'un sommet reste « fermé », `Ā` valant 1,6e-19. Cette
//      propriété-là est tenue par la CONSTRUCTION, pas par l'audit ;
//   ⑦ LA FORME DU COIN — celle de `fenetre-clip.js`, à 1e-15, **et la mer
//      d'`ocean.js` qui épouse encore le socle** ;
//   ⑧ LA DÉCISION 14 — la courbe d'exagération passe EXACTEMENT par les ancres
//      d'aujourd'hui, honore les surcharges de `localStorage`, ne dépasse pas,
//      et **la mesure de contrôle : ×2,0000 au cran → ×1,0040 après**.

import test from 'node:test'
import assert from 'node:assert/strict'
// ⚠️ three N'EST LÀ QUE COMME RÉFÉRENCE (§⑨) : `computeVertexNormals` est la
// vérité contre laquelle on mesure `grid-normals.js`. Le module, lui, ne
// l'importe pas — c'est tout l'intérêt, 83,8 ms contre 4,6.
import * as THREE from 'three'

import {
  construireFenetre,
  majHauteurs,
  appliquerHauteurs,
  contourSocle,
  normaliserEmprise,
  formeCoin,
  exagPalier,
  exagerationContinue,
  courbeExageration,
  creerExagerationPartagee,
  majExageration,
  surchargesStockees,
  zoomDepuisAltitude,
  altitudeDepuisZoom,
  COTE_MONDE,
  DEMI_MONDE,
  MERCATOR_LAT_MAX,
  EXAG_ANCRES,
  EXAG_BASE,
  CLE_EXAG,
} from '../src/monde/fenetre-bornee.js'
import { auditerSolide } from '../src/monde/audit-solide.js'
import { pointCoin, exposantCoin } from '../src/fenetre-clip.js'
import { rayonEauDansSocle, rayonCoinEau } from '../src/plinth.js'
import { TERRAIN_SIZE } from '../src/terrain.js'
import { gridTemplate } from '../src/grid-template.js'
import { blockExtentMeters } from '../src/landmarks.js'
import { empriseSocle, ZOOM_SOCLE, SEUIL_BLOC_M } from '../src/monde/seuil-socle.js'
import { tuilesEmprise } from '../src/monde/flux-terrain.js'
import { FLAGS } from '../src/flags.js'

// ⚠️ **BIS, 2026-09-05 — CES TESTS DÉCRIVENT LE RÉGIME « BISEAU ALLUMÉ ».**
// Adrien a décidé d'éteindre les biseaux du socle et leur retrait
// (`FLAGS.biseauSocle = false` par défaut) ; le code et ses lois restent, et
// c'est ici qu'on les tient. On rallume donc l'interrupteur pour ce fichier —
// un processus par fichier de test, rien ne fuit. Le défaut ÉTEINT est couvert
// par `test/biseau-socle.test.js`, qui prouve aussi que « rallumé » rend le
// solide d'avant au bit près.
FLAGS.biseauSocle = true

// Le réglage de PRODUCTION du coin, lu là où il vit vraiment :
// `main.js:566` `slabCorner = 0,04` (fraction de la largeur du bloc) et
// `slabCornerSmoothing = 0,6`. ⚠️ `ocean.js:1289` fait exactement ce produit.
const RAYON_COIN = 0.04 * TERRAIN_SIZE // 2,24 unités monde
const PUISSANCE_COIN = exposantCoin(0.6) // 4,4

const CHAMONIX = { lat: 45.8326, lon: 6.8652 }
const EMPRISE = empriseSocle({ centre: CHAMONIX })

// ════════════════════════════════════════════════════════════════════════════
// LE BANC — un flux BOUCHONNÉ, qui passe par le VRAI `remplirHauteurs`
// ════════════════════════════════════════════════════════════════════════════
//
// ⚠️ **ON NE BOUCHONNE PAS `remplirHauteurs`, ON BOUCHONNE LE GLOBE.** Un faux
// remplisseur validerait ce fichier contre lui-même ; ici le chemin traversé est
// celui de la production — `tuilesPretes`, le tri du grossier au fin,
// `sampleHeights` avec la vraie `t.size`. Seules les tuiles sont inventées.

function fluxBouchon (emprise, relief, { zoom = ZOOM_SOCLE, size = 256 } = {}) {
  const tiles = new Map()
  for (const { z, x, y } of tuilesEmprise(emprise, zoom)) {
    const h = new Float32Array(size * size)
    const n = 2 ** z
    for (let j = 0; j < size; j++) {
      // `my` : la coordonnée Mercator normalisée du CENTRE du pixel
      const my = (y + (j + 0.5) / size) / n
      for (let i = 0; i < size; i++) {
        const mx = (x + (i + 0.5) / size) / n
        h[j * size + i] = relief(mx, my)
      }
    }
    tiles.set(`${z}/${x}/${y}`, { key: `${z}/${x}/${y}`, z, x, y, size, state: 'ready', heights: h })
  }
  return { globe: { tiles }, demande: { zoom }, reclamees: new Map(), seqDepart: 0 }
}

/** Un relief analytique en mètres, connu partout — voir l'assertion ②(b). */
const RELIEF = (mx, my) => 1000 + 900 * Math.sin(mx * 6000) + 600 * Math.cos(my * 4200)

const fenetreDeBanc = (opts = {}) => construireFenetre({
  emprise: EMPRISE,
  n: 32,
  rayonCoin: RAYON_COIN,
  puissanceCoin: PUISSANCE_COIN,
  ...opts,
})

// ════════════════════════════════════════════════════════════════════════════
// ① LA COQUE
// ════════════════════════════════════════════════════════════════════════════

test('① une fenêtre construite est fermée, orientée, sans dégénéré ni NaN', () => {
  for (const n of [4, 16, 64]) {
    for (const [r, e] of [[0, 2], [RAYON_COIN, PUISSANCE_COIN], [DEMI_MONDE, 6]]) {
      const f = construireFenetre({ emprise: EMPRISE, n, rayonCoin: r, puissanceCoin: e })
      const a = auditerSolide({ geometrie: f.geometrie, indices: f.indices })
      const ou = `n=${n} r=${r} e=${e}`
      assert.equal(a.vide, false, ou)
      assert.equal(a.nan, false, ou)
      assert.equal(a.ferme, true, ou)
      assert.equal(a.oriente, true, ou)
      assert.equal(a.degeneres, 0, ou)
      assert.equal(a.sain, true, ou)
      assert.ok(a.volume > 0, ou)
    }
  }
})

test('① à hauteurs nulles et coins vifs, le volume vaut EXACTEMENT côté² × profondeur', () => {
  // ⚠️ Une valeur FERMÉE, pas une tolérance : c'est elle qui attrape un anneau
  // décalé d'un sommet, un éventail rentré, ou une profondeur mal appliquée —
  // trois défauts qui laissent le solide parfaitement fermé.
  for (const n of [4, 16, 64]) {
    const f = construireFenetre({ emprise: EMPRISE, n, rayonCoin: 0, profondeurDalle: 7 })
    const a = auditerSolide({ geometrie: f.geometrie, indices: f.indices })
    assert.equal(a.volume, COTE_MONDE * COTE_MONDE * 7, `n = ${n}`)
  }
})

test('① la largeur au sol de la fenêtre EST celle de `blockExtentMeters`', () => {
  // ⚠️ 156 543,03392 × 256 et NON 2πR : les deux diffèrent de 32 m, et c'est la
  // première qui fait `dem.extentMeters`. Prendre l'autre ferait diverger
  // l'échelle verticale du DEM, en silence.
  const emp = normaliserEmprise(EMPRISE)
  assert.equal(emp.largeurM, blockExtentMeters(ZOOM_SOCLE, emp.latCentre))
})

// ════════════════════════════════════════════════════════════════════════════
// ② LES DEUX ASSERTIONS QUI MORDENT
// ════════════════════════════════════════════════════════════════════════════

test('② LE PIÈGE — une fenêtre NON remplie est un PAVÉ DROIT, et l\'audit le dit', () => {
  // ⚠️ C'est le contre-test du fichier : il PROUVE que les assertions
  // suivantes portent sur le rééchantillonnage et non sur la construction.
  const f = fenetreDeBanc()
  const a = auditerSolide({ geometrie: f.geometrie, indices: f.indices })
  assert.equal(a.sain, true) // fermé, orienté… et vide de tout relief
  assert.equal(a.hauteurs.distinctes, 2, 'un pavé droit rend 2 hauteurs distinctes')
})

test('② (a) après `majHauteurs`, au moins un sommet INTÉRIEUR diffère du bord', () => {
  const f = fenetreDeBanc()
  majHauteurs(f, fluxBouchon(EMPRISE, RELIEF))
  const a = auditerSolide({ geometrie: f.geometrie, indices: f.indices })
  assert.ok(a.hauteurs.distinctes > 2, `distinctes = ${a.hauteurs.distinctes}`)

  // et la formulation littérale du plan : un sommet intérieur ≠ son bord
  const { parCote, geometrie } = f
  const yBord = geometrie[1] // sommet (0, 0), coin nord-ouest de la nappe
  let vu = false
  for (let j = 1; j < parCote - 1 && !vu; j++) {
    for (let i = 1; i < parCote - 1; i++) {
      if (geometrie[(j * parCote + i) * 3 + 1] !== yBord) { vu = true; break }
    }
  }
  assert.ok(vu, 'aucun sommet intérieur ne diffère du bord : la nappe est plate')
})

test('② (b) la hauteur relevée en un point connu vaut celle du relief bouchonné', () => {
  // ⚠️ L'assertion la plus importante du fichier. Elle compare la géométrie à
  // la SOURCE, pas à elle-même : le relief est analytique, la position du
  // sommet est calculable, la valeur attendue est écrite ici.
  const n = 16
  const f = construireFenetre({ emprise: EMPRISE, n, rayonCoin: 0, exageration: 2.8 })
  majHauteurs(f, fluxBouchon(EMPRISE, RELIEF))

  const emp = normaliserEmprise(EMPRISE)
  const D2R = Math.PI / 180
  const mercX = (lon) => (lon + 180) / 360
  const mercY = (lat) => {
    const la = Math.max(-MERCATOR_LAT_MAX, Math.min(MERCATOR_LAT_MAX, lat)) * D2R
    return (1 - Math.log(Math.tan(la) + 1 / Math.cos(la)) / Math.PI) / 2
  }
  const x0 = mercX(emp.ouest)
  const x1 = x0 + emp.largeurDeg / 360
  const y0 = mercY(emp.nord)
  const y1 = mercY(emp.sud)

  // ⚠️ La grille de `remplirHauteurs` est régulière en MERCATOR, sommet 0 au
  // coin NORD-OUEST, ligne-major. On refait le calcul à la main.
  let pire = 0
  for (const [i, j] of [[0, 0], [n, 0], [0, n], [n, n], [5, 11], [8, 8]]) {
    const mx = x0 + ((x1 - x0) * i) / n
    const my = y0 + ((y1 - y0) * j) / n
    const attendu = RELIEF(mx, my)
    pire = Math.max(pire, Math.abs(f.hauteursM[j * (n + 1) + i] - attendu) / Math.abs(attendu))
  }
  // La tuile bouchon fait 256 px : l'échantillonnage bilinéaire de
  // `sampleHeights` ne peut pas rendre la fonction exacte entre deux pixels.
  // 3e-3 est la marge mesurée sur ce relief (période ~1e-3 en Mercator) ; une
  // hauteur simplement FAUSSE dépasse de plusieurs ordres.
  assert.ok(pire < 3e-3, `écart relatif maximal ${pire}`)

  // et la conversion mètres → monde, mot pour mot celle de `terrain.js`
  const attendu = (f.hauteursM[0] - f.moyenneM) * (COTE_MONDE / emp.largeurM) * 2.8
  assert.ok(Math.abs(f.geometrie[1] - attendu) < 1e-6, `${f.geometrie[1]} ≠ ${attendu}`)
})

// ════════════════════════════════════════════════════════════════════════════
// ③ `majHauteurs` — SANS RECONSTRUIRE LA GÉOMÉTRIE
// ════════════════════════════════════════════════════════════════════════════

test('③ `majHauteurs` ne réalloue rien, ne retriangule rien, ne bouge aucun x/z', () => {
  const f = fenetreDeBanc({ n: 24 })
  const tamponGeo = f.geometrie
  const tamponIdx = f.indices
  const tamponH = f.hauteursM
  const indicesAvant = Uint32Array.from(f.indices)
  const xzAvant = []
  for (let s = 0; s < f.geometrie.length / 3; s++) xzAvant.push(f.geometrie[s * 3], f.geometrie[s * 3 + 2])

  majHauteurs(f, fluxBouchon(EMPRISE, RELIEF))

  // ⚠️ IDENTITÉ DE RÉFÉRENCE, pas égalité de contenu : c'est la seule assertion
  // qui distingue « mis à jour » de « reconstruit à l'identique ».
  assert.equal(f.geometrie, tamponGeo, 'la géométrie a été réallouée')
  assert.equal(f.indices, tamponIdx, 'les indices ont été réalloués')
  assert.equal(f.hauteursM, tamponH, 'le tampon de hauteurs a été réalloué')
  assert.deepEqual(Array.from(f.indices), Array.from(indicesAvant), 'la topologie a bougé')
  for (let s = 0; s < f.geometrie.length / 3; s++) {
    assert.equal(f.geometrie[s * 3], xzAvant[s * 2], `x du sommet ${s}`)
    assert.equal(f.geometrie[s * 3 + 2], xzAvant[s * 2 + 1], `z du sommet ${s}`)
  }
  // …et les y, eux, ont bien changé
  assert.ok(auditerSolide({ geometrie: f.geometrie, indices: f.indices }).hauteurs.distinctes > 2)
})

test('③ deux mises à jour successives rendent la fenêtre au relief courant', () => {
  const f = fenetreDeBanc({ n: 12 })
  const autre = (mx, my) => 4000 * Math.sin(mx * 2000) - 2500 * Math.cos(my * 900)
  majHauteurs(f, fluxBouchon(EMPRISE, RELIEF))
  const max1 = f.maxM
  majHauteurs(f, fluxBouchon(EMPRISE, autre))
  assert.notEqual(f.maxM, max1)
  const a = auditerSolide({ geometrie: f.geometrie, indices: f.indices })
  assert.equal(a.sain, true)
  // et le retour au plat redonne EXACTEMENT le pavé droit du départ
  majHauteurs(f, new Float32Array(f.hauteursM.length))
  assert.equal(auditerSolide({ geometrie: f.geometrie, indices: f.indices }).hauteurs.distinctes, 2)
})

test('③ `baseY` descend sous le point le plus bas de TOUTE la nappe, pas du bord', () => {
  // ⚠️ La règle de `plinth.js:computeSlab` (« not just the border ») : un bassin
  // intérieur profond percerait sinon le fond du socle. Ici la grille EST le
  // relevé — pas de balayage grossier, donc pas de creux manqué.
  const n = 24
  const f = construireFenetre({ emprise: EMPRISE, n, rayonCoin: 0, profondeurDalle: 7 })
  const h = new Float32Array((n + 1) * (n + 1))
  h[Math.floor(h.length / 2) + 3] = -9000 // un gouffre, loin du bord
  majHauteurs(f, h)
  const yMin = (f.minM - f.moyenneM) * f.echelleVerticale
  assert.ok(Math.abs(f.baseY - (yMin - 7)) < 1e-9, `baseY ${f.baseY} pour un creux à ${yMin}`)
  assert.equal(auditerSolide({ geometrie: f.geometrie, indices: f.indices }).sain, true)
})

test('③ `baseYFloor` impose un plancher partagé, comme le damier le demande', () => {
  const f = construireFenetre({ emprise: EMPRISE, n: 8, baseYFloor: -100 })
  majHauteurs(f, new Float32Array(81).fill(500))
  assert.equal(f.baseY, -100)
})

test('③ `contourSocle` rend l\'anneau au format de `computeSlab`', () => {
  // le pont de la décision 5 : la finition de `plinth.js` s'écrit à l'arrêt,
  // sur CE contour — même anneau, même baseY, rien à redeviner.
  const f = fenetreDeBanc({ n: 16 })
  majHauteurs(f, fluxBouchon(EMPRISE, RELIEF))
  const c = contourSocle(f)
  assert.equal(c.ring.length, 4 * 16)
  assert.equal(c.baseY, f.baseY)
  for (let s = 0; s < c.ring.length; s++) {
    const t = f.anneau[s] * 3
    assert.equal(c.ring[s].x, f.geometrie[t])
    assert.equal(c.ring[s].y, f.geometrie[t + 1])
    assert.equal(c.ring[s].z, f.geometrie[t + 2])
  }
  assert.ok(c.borderMin >= c.globalMin - 1e-6)
})

// ════════════════════════════════════════════════════════════════════════════
// ④ LES DEUX PIÈGES DE L'EMPRISE
// ════════════════════════════════════════════════════════════════════════════

test('④ `ouest > est` est LÉGAL — c\'est le franchissement de l\'antiméridien', () => {
  const emp = normaliserEmprise({ ouest: 179.5, est: -179.5, sud: -1, nord: 1 })
  assert.equal(emp.antimeridien, true)
  assert.ok(Math.abs(emp.largeurDeg - 1) < 1e-12, `largeur ${emp.largeurDeg}`)
  const f = construireFenetre({ emprise: { ouest: 179.5, est: -179.5, sud: -1, nord: 1 }, n: 16 })
  assert.equal(auditerSolide({ geometrie: f.geometrie, indices: f.indices }).sain, true)
})

test('④ au-delà de 85,051° l\'emprise est ÉCRÊTÉE, et la fenêtre reste saine', () => {
  const emp = normaliserEmprise({ ouest: 0, est: 1, sud: 84, nord: 89.9 })
  assert.equal(emp.ecretee, true)
  assert.equal(emp.nord, MERCATOR_LAT_MAX)
  assert.equal(emp.sud, 84)
  const f = construireFenetre({ emprise: { ouest: 0, est: 1, sud: -89.9, nord: 89.9 }, n: 12 })
  assert.equal(f.emprise.nord, MERCATOR_LAT_MAX)
  assert.equal(f.emprise.sud, -MERCATOR_LAT_MAX)
  assert.equal(auditerSolide({ geometrie: f.geometrie, indices: f.indices }).sain, true)
})

test('④ une emprise sans nombres finis est REFUSÉE, pas rattrapée', () => {
  assert.throws(() => normaliserEmprise({ ouest: 0, est: NaN, sud: 0, nord: 1 }), TypeError)
  assert.throws(() => construireFenetre({ emprise: null }), TypeError)
})

// ════════════════════════════════════════════════════════════════════════════
// ⑤ CENT EMPRISES, ET LA NON-VACUITÉ
// ════════════════════════════════════════════════════════════════════════════

test('⑤ cent emprises tirées au hasard — dont l\'antiméridien et les pôles — passent CENT fois', () => {
  let graine = 20260821
  const tirage = () => (graine = (graine * 1103515245 + 12345) & 0x7fffffff) / 0x7fffffff
  const n = 20
  const relief = new Float32Array((n + 1) * (n + 1))
  let antimeridiens = 0
  let ecretees = 0
  for (let essai = 0; essai < 100; essai++) {
    const lon = -180 + tirage() * 360
    const lat = -89.5 + tirage() * 179
    const largeur = 0.02 + tirage() * 6
    const hauteur = 0.02 + tirage() * 6
    let est = lon + largeur
    if (est > 180) est -= 360
    const emprise = { ouest: lon, est, sud: lat - hauteur / 2, nord: lat + hauteur / 2 }
    for (let g = 0; g < relief.length; g++) {
      relief[g] = 900 * Math.sin(g * 0.13 + essai) + 400 * Math.cos(g * 0.07)
    }
    const f = construireFenetre({ emprise, n, rayonCoin: RAYON_COIN, puissanceCoin: PUISSANCE_COIN })
    majHauteurs(f, relief)
    if (f.empriseNormalisee.antimeridien) antimeridiens++
    if (f.empriseNormalisee.ecretee) ecretees++
    const a = auditerSolide({ geometrie: f.geometrie, indices: f.indices })
    const ou = `essai ${essai} : ${JSON.stringify(emprise)}`
    assert.equal(a.vide, false, ou)
    assert.equal(a.nan, false, ou)
    assert.equal(a.ferme, true, ou)
    assert.equal(a.oriente, true, ou)
    assert.equal(a.degeneres, 0, ou)
    assert.ok(a.volume > 0, ou)
    // ⚠️ ET LE RÉÉCHANTILLONNAGE, à chaque essai : sans cette ligne on aurait
    // audité cent pavés droits.
    assert.ok(a.hauteurs.distinctes > 2, ou)
  }
  // le tirage DOIT couvrir les deux pièges, sinon il ne prouve rien
  assert.ok(antimeridiens > 0, 'aucune emprise ne franchit l\'antiméridien')
  assert.ok(ecretees > 0, 'aucune emprise n\'atteint l\'écrêtage de Mercator')
})

test('⑤ l\'audit REFUSE de se prononcer sur une géométrie vide', () => {
  // le garde de la Tâche 5, rejoué ici : c'est ainsi que le test de silhouette
  // du prototype passait à vide en se croyant vert.
  const a = auditerSolide({ geometrie: new Float32Array(0), indices: new Uint32Array(0) })
  assert.equal(a.vide, true)
  assert.equal(a.ferme, null)
  assert.equal(a.sain, false)
})

// ════════════════════════════════════════════════════════════════════════════
// ⑥ LA MUTATION
// ════════════════════════════════════════════════════════════════════════════

test('⑥ MUTATION — inverser l\'enroulement de la dalle tue le verdict', () => {
  const f = fenetreDeBanc({ n: 12 })
  majHauteurs(f, fluxBouchon(EMPRISE, RELIEF))
  assert.equal(auditerSolide({ geometrie: f.geometrie, indices: f.indices }).sain, true)

  // la dalle est le DERNIER groupe d'indices : `anneau.length` triangles
  const mute = Uint32Array.from(f.indices)
  const debut = mute.length - f.anneau.length * 3
  for (let t = debut; t < mute.length; t += 3) {
    const tmp = mute[t + 1]
    mute[t + 1] = mute[t + 2]
    mute[t + 2] = tmp
  }
  const a = auditerSolide({ geometrie: f.geometrie, indices: mute })
  assert.equal(a.sain, false, 'la dalle retournée est passée pour saine')
  assert.equal(a.ferme, false, 'Ā ne voit pas la dalle retournée')
})

test('⑥ MUTATION — un mur entier manquant, et la nappe absente, tuent la fermeture', () => {
  const f = fenetreDeBanc({ n: 12 })
  majHauteurs(f, fluxBouchon(EMPRISE, RELIEF))
  const nbNappe = f.n * f.n * 2 * 3
  const nbAnneau = f.anneau.length

  // un côté de paroi retiré — mesuré : écart de fermeture 0,105, contre un
  // seuil de 1e-9. Le VOLUME, lui, reste positif (63 596) : c'est exactement
  // le sabotage que la Tâche 5 a montré invisible au volume seul.
  const garde = []
  for (let t = 0; t < f.indices.length; t += 3) {
    const dansParoi = t >= nbNappe && t < nbNappe + nbAnneau * 6
    if (dansParoi && Math.floor((t - nbNappe) / 6) < f.n) continue // le côté nord
    garde.push(f.indices[t], f.indices[t + 1], f.indices[t + 2])
  }
  const sansMur = auditerSolide({ geometrie: f.geometrie, indices: Uint32Array.from(garde) })
  assert.equal(sansMur.ferme, false, 'un mur manquant est passé pour fermé')
  assert.ok(sansMur.volume > 0, 'le volume seul ne voit rien — c\'est la mesure de la Tâche 5')

  // la nappe retirée — écart de fermeture 0,346
  const sansNappe = auditerSolide({ geometrie: f.geometrie, indices: f.indices.slice(nbNappe) })
  assert.equal(sansNappe.ferme, false, 'une nappe absente est passée pour fermée')
})

test('⑥ CE QUE L\'AUDIT NE VOIT PAS — un anneau décalé d\'un sommet, et sa preuve', () => {
  // ⚠️ **ASSERTION REJOUÉE CONTRE LE DÉPÔT AVANT D'ÊTRE ÉCRITE** (§0). La
  // première version de ce test exigeait que l'audit REFUSE une paroi dont les
  // sommets hauts sont décalés d'un cran sur l'anneau. **C'est faux, et
  // mesuré** : `‖Ā‖` relative = 1,61e-19 contre un seuil de 1e-9, volume
  // positif, orientation bonne, zéro dégénéré. La raison est structurelle — la
  // bande vrillée reste une surface TOPOLOGIQUEMENT FERMÉE entre les deux
  // boucles, et `Ā` est un invariant de fermeture, pas de justesse.
  //
  // ⚠️ **CE DÉFAUT-LÀ N'EST DONC PAS GARDÉ PAR L'AUDIT, IL EST GARDÉ PAR LA
  // CONSTRUCTION** : les sommets hauts des parois SONT les sommets de bord de
  // la nappe — le même index, pas une copie. C'est le test ③ (« aucun x/z ne
  // bouge », identité de référence) qui tient cette propriété, et lui seul.
  const f = fenetreDeBanc({ n: 12 })
  majHauteurs(f, fluxBouchon(EMPRISE, RELIEF))
  const mute = Uint32Array.from(f.indices)
  const nbNappe = f.n * f.n * 2 * 3
  const nbAnneau = f.anneau.length
  for (let s = 0; s < nbAnneau; s++) {
    const base = nbNappe + s * 6
    mute[base] = f.anneau[(s + 1) % nbAnneau]
    mute[base + 1] = f.anneau[(s + 2) % nbAnneau]
    mute[base + 3] = f.anneau[(s + 2) % nbAnneau]
  }
  const a = auditerSolide({ geometrie: f.geometrie, indices: mute })
  assert.equal(a.ferme, true, 'si ceci devient false, l\'audit a gagné une détection — mettez à jour ce commentaire')
  assert.ok(a.fermetureRelative < 1e-15, `‖Ā‖ relative ${a.fermetureRelative}`)

  // la vraie garde : les indices de paroi CITENT l'anneau, ils ne le recopient pas
  for (let s = 0; s < nbAnneau; s++) {
    const base = nbNappe + s * 6
    assert.equal(f.indices[base], f.anneau[s])
    assert.equal(f.indices[base + 1], f.anneau[(s + 1) % nbAnneau])
  }
})

// ════════════════════════════════════════════════════════════════════════════
// ⑦ LA FORME DU COIN — UNE SEULE LOI
// ════════════════════════════════════════════════════════════════════════════

test('⑦ `formeCoin` EST la superellipse de `fenetre-clip.js:pointCoin`', () => {
  // deux copies d'une même règle finissent toujours par diverger ; il n'y en a
  // qu'une, et cette assertion est ce qui l'impose.
  let pire = 0
  for (const expo of [2, 3, PUISSANCE_COIN, 6]) {
    for (let k = 0; k < 512; k++) {
      const angle = (Math.PI / 2) * ((k + 0.5) / 512)
      const [px, pz] = pointCoin(angle, 1, expo)
      const q = Math.max(px, pz)
      pire = Math.max(pire, Math.abs(formeCoin(px / q, pz / q, expo) - q))
    }
  }
  assert.ok(pire < 1e-15, `écart maximal ${pire}`)
})

test('⑦ le BORD de la nappe est sur la superellipse, coins compris', () => {
  // ⚠️ L'assertion qui tue la mutation « ignorer le rayon de coin » : sans le
  // remappage, le sommet de coin resterait à (28, 28) — 0,46 unité DEHORS,
  // c'est-à-dire plus de trois mailles à n = 384.
  const f = fenetreDeBanc({ n: 64 })
  const interieur = DEMI_MONDE - RAYON_COIN
  let pire = 0
  let vuDansLeCoin = 0
  for (const s of f.anneau) {
    const x = Math.abs(f.geometrie[s * 3])
    const z = Math.abs(f.geometrie[s * 3 + 2])
    assert.ok(x <= DEMI_MONDE + 1e-6 && z <= DEMI_MONDE + 1e-6, `(${x}, ${z}) déborde du bloc`)
    if (x <= interieur || z <= interieur) continue
    vuDansLeCoin++
    const u = (x - interieur) / RAYON_COIN
    const v = (z - interieur) / RAYON_COIN
    pire = Math.max(pire, Math.abs(Math.pow(u, PUISSANCE_COIN) + Math.pow(v, PUISSANCE_COIN) - 1))
  }
  assert.ok(vuDansLeCoin >= 4, `${vuDansLeCoin} sommets dans les coins`)
  assert.ok(pire < 1e-5, `u^e + v^e s'écarte de 1 de ${pire}`)
  // le coin du carré, lui, a bel et bien bougé
  const coin = f.anneau[f.n] // le sommet (n, 0)
  assert.ok(Math.abs(f.geometrie[coin * 3]) < DEMI_MONDE - 0.1)
})

test('⑦ la mer d\'`ocean.js` épouse encore le socle — l\'empreinte n\'a pas bougé', () => {
  // ⚠️ La famille de défauts déjà rencontrée deux fois sur ce dépôt : la
  // fenêtre change de forme, la mer ne le sait pas. `ocean.js:1289-1302` tire
  // son clip de `rayonEauDansSocle` / `rayonCoinEau` / `exposantCoin`, tous
  // exprimés sur `TERRAIN_SIZE` et sur la MÊME superellipse. Cette assertion
  // vérifie que la mer reste STRICTEMENT dedans, dans toutes les directions.
  assert.equal(COTE_MONDE, TERRAIN_SIZE, 'la fenêtre a changé d\'empreinte monde')
  const demiEau = rayonEauDansSocle()
  const coinEau = rayonCoinEau(RAYON_COIN)
  const interieurEau = demiEau - coinEau
  const interieur = DEMI_MONDE - RAYON_COIN
  let pireMarge = Infinity
  for (let k = 0; k <= 256; k++) {
    const angle = (Math.PI / 2) * (k / 256)
    const [ex, ez] = pointCoin(angle, coinEau, PUISSANCE_COIN)
    const px = interieurEau + ex
    const pz = interieurEau + ez
    // le rayon de la fenêtre dans cette même direction
    const u = Math.max(0, px - interieur)
    const v = Math.max(0, pz - interieur)
    const dedans = u <= 0 || v <= 0
      ? px <= DEMI_MONDE && pz <= DEMI_MONDE
      : Math.pow(u / RAYON_COIN, PUISSANCE_COIN) + Math.pow(v / RAYON_COIN, PUISSANCE_COIN) <= 1
    assert.ok(dedans, `l'eau sort du socle à ${(angle * 180 / Math.PI).toFixed(1)}° : (${px}, ${pz})`)
    pireMarge = Math.min(pireMarge, DEMI_MONDE - Math.max(px, pz))
  }
  // `SOCLE_CHANFREIN` (0,16) + `SOCLE_MARGE_EAU` (0,06) = 0,22
  assert.ok(pireMarge > 0.2, `marge minimale ${pireMarge}`)
})

// ════════════════════════════════════════════════════════════════════════════
// ⑧ LA DÉCISION 14 — L'EXAGÉRATION VERTICALE CONTINUE
// ════════════════════════════════════════════════════════════════════════════

test('⑧ la courbe passe EXACTEMENT par les ancres d\'aujourd\'hui', () => {
  // ⚠️ « Mêmes valeurs aux mêmes altitudes, interpolées au lieu de sauter » —
  // la moitié « mêmes valeurs » se teste ici, au bit près.
  for (let z = 0; z <= 15; z++) {
    assert.equal(exagerationContinue(z), exagPalier(z), `zoom ${z}`)
  }
  assert.equal(exagPalier(5), 5)
  assert.equal(exagPalier(9), EXAG_BASE)
  assert.deepEqual(EXAG_ANCRES, { 3: 2.5, 4: 2.5, 5: 5, 6: 4, 7: 3.2 })
})

test('⑧ les surcharges de `localStorage` sont HONORÉES', () => {
  // ⚠️ Les retirer casserait un réglage qu'Adrien utilise (`monolith.zoomExag`).
  const surcharges = { 5: 1.4, 12: 6 }
  const courbe = courbeExageration({ surcharges })
  assert.equal(courbe(5), 1.4)
  assert.equal(courbe(12), 6)
  assert.equal(courbe(6), 4) // les ancres non surchargées tiennent
  assert.equal(exagerationContinue(5, { surcharges }), 1.4)

  const faux = { getItem: (c) => (c === CLE_EXAG ? '{"5":1.4,"12":6,"x":"non"}' : null) }
  assert.deepEqual(surchargesStockees(faux), { 5: 1.4, 12: 6 })
  assert.equal(surchargesStockees({ getItem: () => 'pas du json' }), null)
  assert.equal(surchargesStockees({ getItem: () => null }), null)
})

test('⑧ la courbe ne DÉPASSE pas ses ancres — Fritsch–Carlson, pas Catmull-Rom', () => {
  // ⚠️ **CE TEST A MORDU À LA PREMIÈRE EXÉCUTION, ET C'EST TOUT SON INTÉRÊT.**
  // La première version de `pentesMonotones` oubliait l'annulation de pente aux
  // EXTREMUMS locaux : la courbe montait à **5,000746 à z = 5,001**, au-dessus
  // de l'ancre la plus haute, sans qu'aucune ancre le demande. Un relief plus
  // haut que le palier le plus haut, pour un demi-millième de zoom — invisible
  // en lecture. Le dépassement mesuré vaut désormais 4,4e-16, c'est-à-dire le
  // bruit du flottant.
  for (let z = 0; z < 15; z += 0.001) {
    const bas = Math.min(exagPalier(Math.floor(z)), exagPalier(Math.floor(z) + 1))
    const haut = Math.max(exagPalier(Math.floor(z)), exagPalier(Math.floor(z) + 1))
    const v = exagerationContinue(z)
    assert.ok(v >= bas - 1e-12 && v <= haut + 1e-12, `z = ${z} → ${v} hors [${bas}, ${haut}]`)
  }
})

test('⑧ le pont altitude ↔ zoom est celui de `seuil-socle.js`, pas un second réglage', () => {
  // ⚠️ Dérivé, PAS posé : c'est la même équation que celle dont
  // `SEUIL_BLOC_M` est tiré, lue dans l'autre sens.
  //
  // ⚠️ **DEPUIS D21 LE LIEN PORTE LE NOM `SEUIL_BLOC_M`, ET IL N'EST PAS
  // CASSÉ : IL EST RENOMMÉ.** D21 fait naître le crop au palier z7 (600 km), et
  // `SEUIL_NAISSANCE_M` ne descend donc plus de cette équation-là. La grandeur
  // qui en descend — le bloc à 60 % de la hauteur — s'appelle désormais
  // `SEUIL_BLOC_M`, et elle vaut l'ancienne au bit près.
  assert.ok(Math.abs(zoomDepuisAltitude(SEUIL_BLOC_M, { lat: 45 }) - ZOOM_SOCLE) < 1e-12)
  for (const z of [3.25, 7, 11.75]) {
    assert.ok(Math.abs(zoomDepuisAltitude(altitudeDepuisZoom(z, { lat: 45 }), { lat: 45 }) - z) < 1e-12)
  }
  // l'altitude DÉCROÎT quand le zoom croît — sinon la courbe serait lue à l'envers
  assert.ok(altitudeDepuisZoom(3) > altitudeDepuisZoom(13))
})

test('⑧ LA MESURE DE CONTRÔLE — ×2,0000 au cran devient ×1,0040', () => {
  // ⚠️ **LE VOL EST CELUI QUI TRAVERSE LES CRANS D'EXAGÉRATION**, et ce n'est
  // PAS le vol de référence du §0. Mesuré : les ancres z3–z7 vivent entre
  // 33 049 km et 2 065 km d'altitude, quand le vol de référence va de 260 km à
  // 2,2 km — il ne les rencontre jamais, et la mesure y rendrait 1 avant comme
  // après. On prend donc la descente ORBITE → SOCLE, z3 → z13, 45 s à 60 Hz.
  const N = 45 * 60
  const haut = altitudeDepuisZoom(3, { lat: 45 })
  const bas = altitudeDepuisZoom(13, { lat: 45 })
  const alt = (k) => haut * Math.pow(bas / haut, k / (N - 1))
  const rapport = (a, b) => Math.max(a / b, b / a)

  let avant = 1
  let apres = 1
  let pasZoom = 0
  for (let k = 1; k < N; k++) {
    const z0 = zoomDepuisAltitude(alt(k - 1), { lat: 45 })
    const z1 = zoomDepuisAltitude(alt(k), { lat: 45 })
    pasZoom = Math.max(pasZoom, z1 - z0)
    avant = Math.max(avant, rapport(exagPalier(z0), exagPalier(z1)))
    apres = Math.max(apres, rapport(exagerationContinue(z0), exagerationContinue(z1)))
  }
  // AVANT : la marche. Le plus gros cran est z4 → z5 (2,5 → 5).
  assert.equal(avant, 2)
  // APRÈS : 1, à la tolérance du PAS D'ÉCHANTILLONNAGE — et la tolérance est
  // écrite en fonction du pas, pas posée à la main. Mesuré : pas 0,003705 zoom
  // par image, saut résiduel 1,003966.
  assert.ok(apres < 1 + 2 * pasZoom, `saut résiduel ${apres} pour un pas de ${pasZoom}`)
  assert.ok(apres > 1, 'la courbe ne bouge pas : elle n\'interpole rien')
})

test('⑧ LA VALEUR PARTAGÉE — la mer, le socle et le GPX lisent la MÊME', () => {
  // ⚠️ La famille de défauts déjà rencontrée deux fois : un réglage écrit d'un
  // côté, jamais transmis à l'autre. UN écrivain, N lecteurs.
  const partage = creerExagerationPartagee({ lat: 45 })
  const altitudes = [30000, 12000, 4000, 900000, 8_000_000]
  for (const a of altitudes) {
    const ecrit = majExageration(partage, a)
    const lecteurMer = partage.valeur
    const lecteurSocle = partage.valeur
    const lecteurGpx = partage.valeur
    assert.equal(lecteurMer, ecrit)
    assert.equal(lecteurSocle, ecrit)
    assert.equal(lecteurGpx, ecrit)
    assert.equal(ecrit, exagerationContinue(zoomDepuisAltitude(a, { lat: 45 })))
  }
  // une fenêtre construite avec cette valeur la porte telle quelle
  majExageration(partage, 25000)
  const f = construireFenetre({ emprise: EMPRISE, n: 8, exageration: partage.valeur })
  assert.equal(f.exageration, partage.valeur)
})

test('⑧ l\'exagération agit AU RÉÉCHANTILLONNAGE, pas à la construction', () => {
  // ⚠️ C'est la raison pour laquelle la décision 14 ne peut être portée que
  // par ce module : doubler l'exagération double les `y`, sans toucher un seul
  // index ni un seul `x`/`z`.
  const h = new Float32Array(9 * 9)
  for (let g = 0; g < h.length; g++) h[g] = 500 * Math.sin(g * 0.4)
  const a = construireFenetre({ emprise: EMPRISE, n: 8, rayonCoin: 0, exageration: 2.8 })
  const b = construireFenetre({ emprise: EMPRISE, n: 8, rayonCoin: 0, exageration: 5.6 })
  majHauteurs(a, h)
  majHauteurs(b, h)
  for (let g = 0; g < a.nbGrille; g++) {
    assert.ok(Math.abs(b.geometrie[g * 3 + 1] - 2 * a.geometrie[g * 3 + 1]) < 1e-6, `sommet ${g}`)
  }
  // et changer l'exagération EN VOL ne demande qu'une réécriture des y
  const geo = a.geometrie
  a.exageration = 5.6
  appliquerHauteurs(a)
  assert.equal(a.geometrie, geo)
  for (let g = 0; g < a.nbGrille; g++) {
    assert.ok(Math.abs(a.geometrie[g * 3 + 1] - b.geometrie[g * 3 + 1]) < 1e-6, `sommet ${g}`)
  }
})

// ════════════════════════════════════════════════════════════════════════════
// ⑨ LES QUATRE ATTRIBUTS — Tâche 6 ter
// ════════════════════════════════════════════════════════════════════════════
//
// ⚠️ **LA TÂCHE 6 LIVRAIT UNE COQUE, PAS UN MAILLAGE AFFICHABLE.** Le maillage
// de production porte QUATRE attributs — relevé à l'exécution sur un `Terrain`
// réel : `['position', 'uv', 'normal', 'color']`. La fenêtre n'en avait qu'un.
// Ces tests gardent les deux que la 6 ter ajoute (`uv` posée une fois,
// `normales` réécrites en place), **et MESURENT ce que la formule fermée coûte
// dans les pavés de coin** au lieu de le supposer.

/** Les normales de three sur la NAPPE SEULE — mêmes sommets, mêmes triangles. */
function normalesDeThree (f, n) {
  const nb = (n + 1) * (n + 1)
  const g = new THREE.BufferGeometry()
  g.setAttribute('position', new THREE.BufferAttribute(f.geometrie.slice(0, nb * 3), 3))
  g.setIndex(new THREE.BufferAttribute(f.indices.slice(0, n * n * 6), 1))
  g.computeVertexNormals()
  return g.attributes.normal.array
}

/** L'écart angulaire, en degrés, entre deux normales de même index. */
function ecartDegres (a, b, g) {
  const d = a[g * 3] * b[g * 3] + a[g * 3 + 1] * b[g * 3 + 1] + a[g * 3 + 2] * b[g * 3 + 2]
  return (Math.acos(Math.min(1, Math.max(-1, d))) * 180) / Math.PI
}

/** Un relief AVEC son bruit de Nyquist — celui qui trompait la différence
 *  centrée de 3,2° en moyenne (`grid-normals.js`). */
function reliefBruite (n) {
  const h = new Float32Array((n + 1) * (n + 1))
  for (let j = 0; j <= n; j++) {
    for (let i = 0; i <= n; i++) {
      h[j * (n + 1) + i] = 1200 + 800 * Math.sin(i / 7.3) * Math.cos(j / 5.1) + 40 * Math.sin(i * 2.1 + j * 3.7)
    }
  }
  return h
}

test('⑨a les `uv` sont posées UNE FOIS — et c\'est la convention de `gridTemplate`', () => {
  const n = 16
  const f = construireFenetre({ emprise: EMPRISE, n, rayonCoin: 0 })
  const tpl = gridTemplate(n, TERRAIN_SIZE)
  // ⚠️ BIT À BIT contre le gabarit de production : `u = i/n`, `v = 1 − j/n`.
  // Inverser `v` retournerait la rampe et les masques du haut en bas, sans une
  // seule erreur nulle part.
  for (let g = 0; g < f.nbGrille; g++) {
    assert.equal(f.uv[g * 2], tpl.uv[g * 2], `u du sommet ${g}`)
    assert.equal(f.uv[g * 2 + 1], tpl.uv[g * 2 + 1], `v du sommet ${g}`)
    assert.equal(f.geometrie[g * 3], tpl.position[g * 3], `x du sommet ${g}`)
    assert.equal(f.geometrie[g * 3 + 2], tpl.position[g * 3 + 2], `z du sommet ${g}`)
  }
  // …et la topologie de la nappe est celle du gabarit, index pour index
  assert.equal(f.trianglesNappe, n * n * 2)
  for (let k = 0; k < n * n * 6; k++) assert.equal(f.indices[k], tpl.index[k], `index ${k}`)
})

test('⑨b `majHauteurs` met à jour les NORMALES, et ne réalloue toujours rien', () => {
  const f = fenetreDeBanc({ n: 24 })
  const tamponN = f.normales
  const tamponUV = f.uv
  const uvAvant = Float32Array.from(f.uv)
  const nAvant = Float32Array.from(f.normales)

  majHauteurs(f, fluxBouchon(EMPRISE, RELIEF))

  // ⚠️ IDENTITÉ DE RÉFÉRENCE — la seule assertion qui distingue « mis à jour »
  // de « reconstruit à l'identique ».
  assert.equal(f.normales, tamponN, 'les normales ont été réallouées')
  assert.equal(f.uv, tamponUV, 'les `uv` ont été réallouées')
  // les `uv` ne dépendent que des x/z : elles n'ont pas bougé d'un bit
  assert.deepEqual(Array.from(f.uv), Array.from(uvAvant), 'les `uv` ont bougé')
  // les normales, elles, suivent le relief
  let bougees = 0
  for (let g = 0; g < f.nbGrille; g++) if (f.normales[g * 3] !== nAvant[g * 3]) bougees++
  assert.ok(bougees > f.nbGrille / 2, `${bougees} normales sur ${f.nbGrille} seulement ont suivi le relief`)
  // et elles sont unitaires, jupe comprise
  for (let s = 0; s < f.nbSommets; s++) {
    const l = Math.hypot(f.normales[s * 3], f.normales[s * 3 + 1], f.normales[s * 3 + 2])
    assert.ok(Math.abs(l - 1) < 1e-6, `normale ${s} de longueur ${l}`)
  }
})

test('⑨c à coins vifs, les normales sont celles de three — bord et coins compris', () => {
  // ⚠️ CE N'EST PAS UNE APPROXIMATION. `grid-normals.js` est la forme fermée de
  // la somme des six faces sur une grille régulière : à `rayonCoin = 0` la
  // nappe EST une grille régulière, donc le résultat est celui de
  // `computeVertexNormals` à l'arrondi Float32 près.
  const n = 32
  const f = construireFenetre({ emprise: EMPRISE, n, rayonCoin: 0 })
  majHauteurs(f, reliefBruite(n))
  const ref = normalesDeThree(f, n)
  let pire = 0
  for (let g = 0; g < f.nbGrille; g++) pire = Math.max(pire, ecartDegres(f.normales, ref, g))
  // mesuré : 0,0226° à n = 64, 0,0221° à n = 384 — le seuil de 0,05° est celui
  // que `terrain.js` annonce déjà pour le chemin de production.
  assert.ok(pire < 0.05, `écart maximal ${pire.toFixed(4)}°`)
})

test('⑨d ⚠️ CE QUE LA FORME FERMÉE COÛTE DANS LES PAVÉS DE COIN — mesuré', () => {
  // ⚠️ **L'HYPOTHÈSE DE `gridNormals` EST LE PAS RÉGULIER, ET `versEmpreinte`
  // LA CASSE DANS LES QUATRE COINS.** Ce test ne garde pas une propriété : il
  // MESURE le défaut, pour qu'il ne se découvre pas à l'écran. C'est aussi ce
  // qui justifie `rayonCoin = 0` au branchement de la 6 ter — la forme du coin
  // restant celle de `plinth.js`, exactement comme aujourd'hui.
  const n = 64
  const f = construireFenetre({ emprise: EMPRISE, n, rayonCoin: RAYON_COIN, puissanceCoin: PUISSANCE_COIN })
  majHauteurs(f, reliefBruite(n))
  const ref = normalesDeThree(f, n)
  const interieur = DEMI_MONDE - RAYON_COIN
  let pireCoin = 0
  let pireHors = 0
  let nCoin = 0
  for (let g = 0; g < f.nbGrille; g++) {
    const d = ecartDegres(f.normales, ref, g)
    const dansCoin = Math.abs(f.geometrie[g * 3]) > interieur && Math.abs(f.geometrie[g * 3 + 2]) > interieur
    if (dansCoin) { nCoin++; pireCoin = Math.max(pireCoin, d) } else pireHors = Math.max(pireHors, d)
  }
  // Mesuré au réglage de PRODUCTION du coin (`rayonCoin` 2,24, `puissanceCoin`
  // 4,4), sur ce même relief :
  //   n =  64 → coin : 27,95° au pire, 3,55° en moyenne sur 36 sommets (0,85 %)
  //   n = 384 → coin : 63,14° au pire, 4,49° en moyenne sur 1 024 (0,69 %)
  //   hors coin : 1,26° et 1,47° — les sommets voisins du pavé, pas plus loin.
  // ⚠️ Le seuil ci-dessous n'est PAS un contrat de qualité : il verrouille le
  // FAIT que l'écart existe et qu'il est grand, pour que personne ne branche la
  // fenêtre à coins arrondis en croyant les normales exactes.
  assert.ok(nCoin > 0, 'aucun sommet dans les pavés de coin — le banc ne prouve rien')
  assert.ok(pireCoin > 10, `l'écart de coin n'est plus que ${pireCoin.toFixed(2)}° : re-mesurer avant de conclure`)
  assert.ok(pireHors < 2, `hors coin ${pireHors.toFixed(2)}° — la grille régulière devrait rester exacte`)
})

test('⑨e la JUPE porte ses propres normales, posées une fois', () => {
  const f = fenetreDeBanc({ n: 12 })
  majHauteurs(f, fluxBouchon(EMPRISE, RELIEF))
  for (let s = 0; s < f.anneau.length; s++) {
    const b = (f.iBas + s) * 3
    // l'anneau bas : sortante HORIZONTALE (la paroi l'emporte sur la dalle, qui
    // regarde le sol et n'est jamais vue)
    assert.equal(f.normales[b + 1], 0, `la normale du bas ${s} n'est pas horizontale`)
    const x = f.geometrie[b]
    const z = f.geometrie[b + 2]
    assert.ok(f.normales[b] * x + f.normales[b + 2] * z > 0, `la normale du bas ${s} rentre au lieu de sortir`)
    // les `uv` du bas doublent celles du sommet de bord qu'il prolonge
    assert.equal(f.uv[(f.iBas + s) * 2], f.uv[f.anneau[s] * 2])
    assert.equal(f.uv[(f.iBas + s) * 2 + 1], f.uv[f.anneau[s] * 2 + 1])
  }
  // le centre de l'éventail regarde le sol
  assert.deepEqual(
    [f.normales[f.iCentre * 3], f.normales[f.iCentre * 3 + 1], f.normales[f.iCentre * 3 + 2]],
    [0, -1, 0],
  )
  // ⚠️ et le sommet HAUT d'une paroi EST le sommet de bord de la nappe : il
  // porte donc la normale de la NAPPE, pas celle de la paroi. Écrit noir sur
  // blanc parce que ça se voit à l'écran — la paroi se lit comme un congé.
  assert.ok(f.normales[f.anneau[3] * 3 + 1] > 0.5, 'le sommet de bord devrait regarder vers le haut')
})

test('⑨f MUTATION — réallouer les normales tue ⑨b', () => {
  // c'est la mutation de l'Étape 5 : « réintroduire une reconstruction ».
  const f = fenetreDeBanc({ n: 8 })
  const tamponN = f.normales
  f.normales = new Float32Array(f.normales.length) // la reconstruction, en un geste
  appliquerHauteurs(f)
  assert.notEqual(f.normales, tamponN, 'le banc de mutation ne mute rien')
  // …et l'assertion de ⑨b, rejouée telle quelle, doit tomber
  assert.throws(() => assert.equal(f.normales, tamponN, 'les normales ont été réallouées'))
})
