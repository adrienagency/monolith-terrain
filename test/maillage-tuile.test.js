// LE MAILLAGE D'UNE TUILE — Tâche P11 du plan « LE STUDIO SUR LE GLOBE ».
//
// ══════════ CE QUE CE FICHIER VÉRIFIE, ET CE QU'IL NE PEUT PAS ══════════════
//
// Même partage que `crop-sphere`, `crop-parois`, `crop-rampe` et `fond-crop` :
//   ① LA LOI vit dans un module PUR et se vérifie sous node ;
//   ② LE DÉPÔT est confronté à cette loi en EXÉCUTANT son code, pas en
//      cherchant un nom dedans — `_buildMesh` est appelé pour de vrai, sur une
//      tuile factice, et l'on compare la surface qu'il POSE à celle que
//      `interpolerMaille` PRÉDIT.
//
// ⚠️ **CE QUI RESTE HORS DE PORTÉE** : que la paroi et la surface coïncident À
// L'ÉCRAN. Seul le banc le dit (`.banc/P11/m1-bord.js`), et son chiffre est dans
// le compte rendu.

import test from 'node:test'
import assert from 'node:assert/strict'
import { readFileSync } from 'node:fs'

import { segmentsTuile, interpolerMaille } from '../src/monde/maillage-tuile.js'
import { Globe, sampleHeights } from '../src/globe.js'
import { altitudeMaillage } from '../src/monde/fond-crop.js'
import { tileToLatLon, latLonToSphere, R_GLOBE, EARTH_RADIUS_M } from '../src/geo.js'
import { repereCrop, latLonDeLocal } from '../src/monde/crop-sphere.js'
import { contourCrop, PAS_CONTOUR } from '../src/monde/parois-crop.js'
import { echantillonnerFond } from '../src/monde/fond-crop.js'
import { creerEchelleContinue } from '../src/monde/echelle-continue.js'
import { RAMPE_MONDE } from '../src/monde/rampe-crop.js'

const SRC_GLOBE = readFileSync(new URL('../src/globe.js', import.meta.url), 'utf8')

// ══════════ ① LA TABLE DES SEGMENTS — UNE SEULE ÉCRITURE ═══════════════════

test('①a `segmentsTuile` rend la table du dépôt, cran par cran', () => {
  // ⚠️ Les quatre paliers viennent de `gridFor`, DÉPLACÉE et non recopiée. Le
  // commentaire d'origine explique le pourquoi des bas zooms : une tuile z3
  // couvre 45 degrés et 24 segments y laissent des facettes sur le limbe.
  for (const z of [0, 1, 2]) assert.equal(segmentsTuile(z), 64, 'z' + z)
  assert.equal(segmentsTuile(3), 48)
  for (const z of [4, 5]) assert.equal(segmentsTuile(z), 32, 'z' + z)
  for (const z of [6, 11, 12, 22]) assert.equal(segmentsTuile(z), 24, 'z' + z)
})

test('①b `globe.js` NE RÉÉCRIT PAS la table — il l’importe', () => {
  // ⛔ **C'EST LE TEST QUI EMPÊCHE LA DEUXIÈME ÉCRITURE.** Deux tables jumelles
  // divergeraient en silence, et la paroi se poserait alors sur une grille que
  // le maillage n'a pas — c'est-à-dire exactement le défaut que la Tâche P11
  // répare. Un `grep` du nom ne suffirait pas : on exige l'IMPORT **et**
  // l'absence des quatre paliers dans le fichier.
  assert.match(SRC_GLOBE, /import \{[^}]*segmentsTuile[^}]*\} from '\.\/monde\/maillage-tuile\.js'/s)
  assert.ok(!/function gridFor/.test(SRC_GLOBE), 'gridFor est resté dans globe.js')
  assert.ok(!/z <= 3\) return 48/.test(SRC_GLOBE), 'la table des segments est réécrite dans globe.js')
})

// ══════════ ② L'INTERPOLATION — LES NŒUDS, PUIS LA DIAGONALE ═══════════════

/** Une grille de hauteurs quelconque mais reproductible. */
const grille = (G) => (i, j) => Math.sin(i * 0.7 + 1) * 100 + Math.cos(j * 1.1) * 60 + i * j * 0.3 + (i === 3 && j === 5 ? -900 : 0)

test('②a aux QUATRE NŒUDS d’une cellule, l’interpolation rend la valeur du nœud', () => {
  const G = 24
  const h = grille(G)
  for (const [i, j] of [[0, 0], [3, 5], [4, 6], [G - 1, G - 1], [G, G]]) {
    const v = interpolerMaille(i / G, j / G, G, h)
    assert.ok(Math.abs(v - h(i, j)) < 1e-9, `nœud (${i},${j}) : ${v} contre ${h(i, j)}`)
  }
})

test('②b la surface est CONTINUE en travers de la diagonale du tampon d’indices', () => {
  // ⛔ **LA DIAGONALE EST `b–c`, C'EST-À-DIRE `su + sv = 1`.** `_buildMesh`
  // écrit `indices.push(a, c, b, b, c, d)`. Si l'on prenait l'autre diagonale,
  // les deux formules ne se rejoindraient PAS sur cette droite — et le test
  // ci-dessous le montre en la prenant vraiment.
  const G = 24
  const h = grille(G)
  const eps = 1e-7
  for (const s of [0.1, 0.25, 0.5, 0.75, 0.9]) {
    const i = 3, j = 5
    const av = interpolerMaille((i + s) / G, (j + 1 - s - eps) / G, G, h)
    const ap = interpolerMaille((i + s) / G, (j + 1 - s + eps) / G, G, h)
    assert.ok(Math.abs(av - ap) < 1e-3, `saut de ${Math.abs(av - ap)} sur la diagonale à s=${s}`)
  }
  // ⚠️ **ET LE TÉMOIN : L'AUTRE DIAGONALE, ELLE, SAUTE.** Sans lui ce test
  // serait vert sur n'importe quelle interpolation lisse, et ne prouverait rien.
  const autre = (tu, tv) => {
    const fu = tu * G, fv = tv * G
    const i = Math.floor(fu), j = Math.floor(fv)
    const su = fu - i, sv = fv - j
    const A = h(i, j), B = h(i + 1, j), C = h(i, j + 1), D = h(i + 1, j + 1)
    return su >= sv ? B + (1 - su) * (A - B) + sv * (D - B) : C + su * (D - C) + (1 - sv) * (A - C)
  }
  const s = 0.5, i = 3, j = 5
  const saut = Math.abs(autre((i + s) / G, (j + 1 - s - eps) / G) - interpolerMaille((i + s) / G, (j + 1 - s - eps) / G, G, h))
  assert.ok(saut > 100, `les deux diagonales ne se distinguent pas (${saut} m) — le test ne prouve rien`)
})

test('②c elle LISSE ce que la donnée porte entre deux nœuds — c’est le sujet', () => {
  // ⚡ **C'EST LA PROPRIÉTÉ QU'ON VEUT, PAS UN DÉFAUT QU'ON TOLÈRE.** Une ravine
  // qui tombe ENTRE deux nœuds n'est pas dessinée : le GPU tend une corde
  // par-dessus. La paroi doit suivre CETTE corde, sinon la surface pend
  // par-dessus son arête haute.
  const G = 24
  const plat = () => 1000
  const ravine = (i, j) => (i === 4 && j === 5 ? 100 : 1000)
  // au milieu de la cellule (3,5) : le nœud creux est un COIN de la cellule
  // voisine, donc la corde le voit ; au milieu de (1,1) il n'existe pas.
  assert.equal(interpolerMaille(1.5 / G, 1.5 / G, G, ravine), plat())
  const auCoin = interpolerMaille(4 / G, 5 / G, G, ravine)
  assert.equal(auCoin, 100, 'le nœud creux lui-même doit être rendu exactement')
})

test('②d un `G` non entier ou nul ne fabrique pas de NaN', () => {
  // ⚠️ Un `NaN` dans une position de sommet ne lève RIEN — il fabrique une
  // géométrie invisible et une boîte englobante vide. Même doctrine que le
  // plancher de division de `rampe-crop.js`.
  const h = grille(24)
  for (const G of [1, 0, -3, 24.4, 23.6]) {
    const v = interpolerMaille(0.37, 0.62, G, h)
    assert.ok(Number.isFinite(v), `G=${G} rend ${v}`)
  }
  for (const q of [-1, 0, 1, 2]) {
    assert.ok(Number.isFinite(interpolerMaille(q, q, 24, h)), 'q=' + q)
  }
  // ⛔ **ET LE PLANCHER `Math.max(1, …)` A UN EFFET, UNE SURVIVANTE L'A DIT.**
  // Sans lui, `G = 0` rend `i = -1` : la loi lit un nœud QUI N'EXISTE PAS, à
  // l'extérieur de la tuile. Le rendu reste fini — donc « pas de NaN » ne
  // prouvait rien — mais ce n'est plus la surface. Avec le plancher, un `G`
  // dégénéré rend la MÊME chose qu'une grille à une seule cellule.
  for (const G of [0, -3, 0.4]) {
    assert.equal(interpolerMaille(0.37, 0.62, G, h), interpolerMaille(0.37, 0.62, 1, h), 'G=' + G)
  }
  assert.notEqual(interpolerMaille(0.37, 0.62, 1, h), h(-1, -1), 'le témoin est vide')
})

// ══════════ ③ LE DÉPÔT, EXÉCUTÉ — `_buildMesh` CONTRE LA LOI ═══════════════

/** Une tuile terrarium factice : un relief à haute fréquence, encodé exactement. */
function tuileFactice(size = 256, f = (u, v) => 1200 + 900 * Math.sin(u * 37) * Math.cos(v * 41)) {
  const heights = new Float32Array(size * size)
  for (let y = 0; y < size; y++) {
    for (let x = 0; x < size; x++) heights[y * size + x] = f((x + 0.5) / size, (y + 0.5) / size)
  }
  return { heights, size }
}

test('③a `interpolerMaille` REND LA SURFACE QUE `_buildMesh` POSE — flèche mesurée, pas supposée', () => {
  // ⚠️ **ON APPELLE `_buildMesh` POUR DE VRAI**, avec le `this` minimal qu'il
  // lit — le patron de la Tâche B (« `hauteurSurface` n'était testée que par un
  // `grep` de son nom »).
  const z = 12, tx = 2094, ty = 2270
  const { heights, size } = tuileFactice()
  const t = { z, x: tx, y: ty, heights, size, texture: null, chord: 0.15 }
  const faux = {
    exaggeration: 2,
    _fondCrop: null,
    group: { add() {} },
    _materialFor: () => ({}),
    _retaillerJupe: () => false,
    tiles: new Map(),
  }
  Globe.prototype._buildMesh.call(faux, t)
  const geo = t.mesh.geometry
  const pos = geo.attributes.position.array
  const G = segmentsTuile(z)
  const dispScale = (R_GLOBE / EARTH_RADIUS_M) * faux.exaggeration
  const noeud = (i, j) => altitudeMaillage(sampleHeights(heights, i / G, j / G, size), null)

  // ⚡ **LA COMPARAISON EST FAITE SUR LA GÉOMÉTRIE, PAS SUR UNE FORMULE.** On
  // prend le milieu d'une cellule, on interpole les POSITIONS 3D comme le GPU,
  // et on confronte le rayon obtenu à celui que la loi prédit.
  const P = (s) => [pos[s * 3] + t.mesh.position.x, pos[s * 3 + 1] + t.mesh.position.y, pos[s * 3 + 2] + t.mesh.position.z]
  let pire = 0
  for (const [i, j] of [[0, 0], [5, 7], [11, 3], [G - 1, G - 1], [17, 20]]) {
    for (const [su, sv] of [[0.25, 0.25], [0.5, 0.5], [0.75, 0.1], [0.1, 0.75], [0.9, 0.9]]) {
      const a = P(j * (G + 1) + i)
      const b = P(j * (G + 1) + i + 1)
      const c = P((j + 1) * (G + 1) + i)
      const d = P((j + 1) * (G + 1) + i + 1)
      const gpu = su + sv <= 1
        ? [0, 1, 2].map((k) => a[k] + su * (b[k] - a[k]) + sv * (c[k] - a[k]))
        : [0, 1, 2].map((k) => d[k] + (1 - su) * (c[k] - d[k]) + (1 - sv) * (b[k] - d[k]))
      const rayonGpu = Math.hypot(gpu[0], gpu[1], gpu[2])
      const hGpu = (rayonGpu - R_GLOBE) / dispScale
      const hLoi = interpolerMaille((i + su) / G, (j + sv) / G, G, noeud)
      pire = Math.max(pire, Math.abs(hGpu - hLoi))
    }
  }
  // ⚠️ **LA BORNE EST LA FLÈCHE DE LA CORDE, ET ELLE EST DÉRIVÉE, PAS CHOISIE** :
  // `d² / (8 R)` avec `d` le côté de la cellule (une tuile z12 fait 9 780 m à
  // l'équateur, divisée par 24 : 407 m) et `R = 6 371 km` — soit **3,3 mm**.
  // Un centimètre laisse la place à l'arrondi float32 des positions.
  const cote = (40075016.686 / 2 ** z) / G
  const fleche = (cote * cote) / (8 * EARTH_RADIUS_M)
  assert.ok(fleche < 0.01, 'la flèche théorique vaut ' + fleche + ' m')
  assert.ok(pire < 0.01, `la loi s’écarte de la géométrie de ${pire} m (flèche théorique ${fleche} m)`)
  // ⚡ **ET LE TÉMOIN : LA TEXTURE, ELLE, S'EN ÉCARTE DE PLUSIEURS CENTAINES DE
  // MÈTRES.** Sans lui, ③a serait vert sur n'importe quelle loi assez lisse.
  let ecartTexture = 0
  for (const [i, j] of [[5, 7], [11, 3], [17, 20]]) {
    const u = (i + 0.5) / G, v = (j + 0.5) / G
    ecartTexture = Math.max(ecartTexture, Math.abs(
      sampleHeights(heights, u, v, size) - interpolerMaille(u, v, G, noeud),
    ))
  }
  assert.ok(ecartTexture > 100, `la texture et le maillage ne se distinguent pas (${ecartTexture} m) — le témoin est vide`)
})

test('③b `latLonToSphere` du dépôt confirme la flèche — la corde passe SOUS l’arc', () => {
  // ⚠️ **LE SIGNE COMPTE** : la corde d'un arc passe toujours SOUS lui. C'est ce
  // qui borne l'écart PAR EN DESSOUS et interdit à la paroi de dépasser la
  // surface pour cette raison-là.
  const z = 12, G = segmentsTuile(z)
  const a = tileToLatLon(2094, 2270, z)
  const b = tileToLatLon(2094 + 1 / G, 2270, z)
  const pa = latLonToSphere(a.lat, a.lon, R_GLOBE)
  const pb = latLonToSphere(b.lat, b.lon, R_GLOBE)
  const milieu = [(pa.x + pb.x) / 2, (pa.y + pb.y) / 2, (pa.z + pb.z) / 2]
  const r = Math.hypot(milieu[0], milieu[1], milieu[2])
  assert.ok(r < R_GLOBE, 'la corde devrait passer sous la sphère')
  const enMetres = (R_GLOBE - r) * (EARTH_RADIUS_M / R_GLOBE)
  assert.ok(enMetres > 0 && enMetres < 0.02, 'flèche mesurée : ' + enMetres + ' m')
})

// ══════════ ④ `hauteurDessinee` — LA SURFACE, PAS LA DONNÉE ════════════════

/** Le globe minimal que les deux sondes lisent. */
function globePourSondes({ z = 12, tx = 2094, ty = 2270, f } = {}) {
  const { heights, size } = tuileFactice(256, f)
  const t = { z, x: tx, y: ty, heights, size, key: `${z}/${tx}/${ty}` }
  return {
    _fondCrop: null,
    tiles: new Map([[t.key, t]]),
    tuilesAvecHauteurs: () => [t],
    hauteurSurface: Globe.prototype.hauteurSurface,
    hauteurDessinee: Globe.prototype.hauteurDessinee,
    _tuileLaPlusFine: Globe.prototype._tuileLaPlusFine,
    tuile: t,
  }
}

test('④a `hauteurDessinee` rend la CORDE du maillage là où `hauteurSurface` rend la DONNÉE', () => {
  // ⛔ **C'EST TOUT LE DÉFAUT DU NOTEUR, RÉDUIT À DEUX APPELS.** On fabrique une
  // tuile PLATE percée d'une ravine d'un seul texel : le maillage (24 quads pour
  // 256 texels) ne peut pas la voir, la texture la voit en entier.
  const size = 256
  // ⚠️ **AU MILIEU D'UNE CELLULE, PAS SUR UN NŒUD** : `0,5` tombe EXACTEMENT sur
  // le nœud 12 d'une grille de 24, où le maillage LIT la texture. Le centre de
  // la cellule (12, 12) est à `12,5 / 24`, et c'est là que la corde passe.
  const CIBLE = 12.5 / 24
  const creux = (u, v) => (Math.abs(u - CIBLE) < 1.5 / size && Math.abs(v - CIBLE) < 1.5 / size ? 100 : 1000)
  const g = globePourSondes({ f: creux })
  const t = g.tuile
  const { lat, lon } = tileToLatLon(t.x + CIBLE, t.y + CIBLE, t.z)
  const liste = g.tuilesAvecHauteurs()
  const texture = g.hauteurSurface(lat, lon, liste)
  const dessinee = g.hauteurDessinee(lat, lon, liste)
  assert.ok(texture < 400, 'la texture doit voir la ravine, elle rend ' + texture)
  assert.ok(dessinee > 990, 'le maillage ne peut PAS la voir, il rend ' + dessinee)
  assert.ok(Math.abs(texture - dessinee) > 500, 'les deux sondes ne se distinguent pas')
})

test('④b sur un NŒUD du maillage, les deux sondes se rejoignent', () => {
  // ⚠️ **LE TÉMOIN INVERSE, ET IL EST OBLIGATOIRE** : sans lui, ④a serait vert
  // sur une sonde qui rendrait n'importe quoi. Au nœud, le maillage LIT la
  // texture par `sampleHeights`, donc les deux valent le même nombre.
  const g = globePourSondes()
  const t = g.tuile
  const G = segmentsTuile(t.z)
  const liste = g.tuilesAvecHauteurs()
  for (const [i, j] of [[6, 9], [12, 12], [23, 4]]) {
    const { lat, lon } = tileToLatLon(t.x + i / G, t.y + j / G, t.z)
    const a = g.hauteurSurface(lat, lon, liste)
    const b = g.hauteurDessinee(lat, lon, liste)
    assert.ok(Math.abs(a - b) < 1e-6, `nœud (${i},${j}) : ${a} contre ${b}`)
  }
})

test('④c hors de toute tuile, elle rend `null` — JAMAIS zéro', () => {
  // ⚠️ **LE §7 DE `parois-crop.js`, APPLIQUÉ À LA SECONDE SONDE** : « zéro est le
  // NIVEAU DE LA MER, et le confondre avec je ne sais pas creuse une encoche
  // dans la paroi ». La nouvelle sonde a exactement le même contrat que
  // l'ancienne, sinon la garde de couverture ne mordrait plus.
  const g = globePourSondes()
  assert.equal(g.hauteurDessinee(0, 0, g.tuilesAvecHauteurs()), null)
  assert.equal(g.hauteurSurface(0, 0, g.tuilesAvecHauteurs()), null)
})

// ══════════ ⑤ LE BRANCHEMENT — EXÉCUTÉ, PAS CHERCHÉ ═══════════════════════

test('⑤a `construireParoisCrop` POSE SON ANNEAU SUR `hauteurDessinee` — et pas une fois sur `hauteurSurface`', () => {
  // ⚠️ **UNE ASSERTION DE TEXTE SERAIT VERTE LE JOUR OÙ QUELQU'UN ÉCRIT LE NOM
  // DANS UN COMMENTAIRE.** On appelle donc la méthode et on COMPTE les appels.
  const { heights, size } = tuileFactice()
  const z = 12, tx = 2094, ty = 2270
  const t = { z, x: tx, y: ty, heights, size, key: `${z}/${tx}/${ty}` }
  const { lat, lon } = tileToLatLon(tx + 0.5, ty + 0.5, z)
  const repere = repereCrop({ centre: { lat, lon }, zoom: z, tuilesParBloc: 1 })
  let nDessinee = 0
  let nSurface = 0
  const faux = {
    _crop: repere,
    _fondCrop: null,
    _parois: null,
    _baseYCrop: null,
    exaggeration: 2,
    tiles: new Map([[t.key, t]]),
    tuilesAvecHauteurs: () => [t],
    uniforms: {
      uCropCoin: { value: 0.08 },
      uCropCoinN: { value: 4.4 },
    },
    group: { add() {}, remove() {} },
    hauteurSurface(...a) { nSurface++; return Globe.prototype.hauteurSurface.apply(this, a) },
    hauteurDessinee(...a) { nDessinee++; return Globe.prototype.hauteurDessinee.apply(this, a) },
    _retaillerJupes: () => 0,
    _paroisMateriau: () => null,
    _tuileLaPlusFine: Globe.prototype._tuileLaPlusFine,
  }
  let sorti = null
  try {
    sorti = Globe.prototype.construireParoisCrop.call(faux, {})
  } catch (e) {
    // la géométrie three peut ne pas se monter dans ce stub ; ce qui compte est
    // ce qui a été APPELÉ avant, et l'anneau est bâti en tout premier
    sorti = 'levee: ' + e.message
  }
  assert.ok(nDessinee > 500, `l'anneau n'a lu la surface DESSINÉE que ${nDessinee} fois`)
  assert.equal(nSurface, 0, `⛔ la paroi lit encore la texture : ${nSurface} appels`)
  assert.ok(sorti !== null)
})

test('⑤b `poserRampe`, LUI, RESTE SUR `hauteurSurface` — la couleur lit la DONNÉE', () => {
  // ⚡ **LES DEUX QUESTIONS SONT DIFFÉRENTES, ET LES CONFONDRE EST CE QUI A
  // PRODUIT LE DRAPÉ.** Le nuanceur colore par `decodeMetersAA(vUv)`, c'est-à-dire
  // à la résolution de la TEXTURE ; la rampe doit donc mesurer le relief à cette
  // résolution-là. La paroi, elle, est de la GÉOMÉTRIE. Une mutation qui
  // basculerait les deux d'un coup meurt ici.
  const { heights, size } = tuileFactice()
  const z = 12, tx = 2094, ty = 2270
  const t = { z, x: tx, y: ty, heights, size, key: `${z}/${tx}/${ty}` }
  const { lat, lon } = tileToLatLon(tx + 0.5, ty + 0.5, z)
  let nSurface = 0
  let nDessinee = 0
  let nListe = 0
  const faux = {
    _crop: repereCrop({ centre: { lat, lon }, zoom: z, tuilesParBloc: 1 }),
    _fondCrop: null,
    _echelleContinue: creerEchelleContinue(RAMPE_MONDE),
    _rampe: null,
    tiles: new Map([[t.key, t]]),
    tuilesAvecHauteurs: () => { nListe++; return [t] },
    uniforms: {
      uCropCoin: { value: 0.08 },
      uCropCoinN: { value: 4.4 },
      uLandBas: { value: 0 }, uLandMax: { value: 5600 },
      uOceanDepth: { value: 6000 }, uReliefBas: { value: -6000 },
      uPlancherRampeM: { value: 0 }, uMerZeroSousEau: { value: 0 },
      uMerRampeOn: { value: 0 }, uMerFondBudgetM: { value: 6000 },
    },
    hauteurSurface(...a) { nSurface++; return Globe.prototype.hauteurSurface.apply(this, a) },
    hauteurDessinee(...a) { nDessinee++; return Globe.prototype.hauteurDessinee.apply(this, a) },
    _poserUniformesRampe: Globe.prototype._poserUniformesRampe,
    _tuileLaPlusFine: Globe.prototype._tuileLaPlusFine,
  }
  const r = Globe.prototype.poserRampe.call(faux, {})
  assert.equal(r.refus, null, JSON.stringify(r))
  assert.ok(nSurface > 500, `la rampe n'a lu la texture que ${nSurface} fois`)
  assert.equal(nDessinee, 0, `⛔ la rampe a basculé sur le maillage : ${nDessinee} appels`)
  // ⚠️ **ET LA LISTE EST PRÉ-FILTRÉE UNE FOIS ICI AUSSI** — une survivante l’a
  // demandé : `hauteurSurface` qui jette le `candidates` qu’on lui passe reste
  // correcte et reparcourt `this.tiles` à chacun des `pas²` points.
  assert.equal(nListe, 1, 'la liste de tuiles a été rebâtie ' + nListe + ' fois')
})

// ══════════ ⑥ CE QUE CINQ SURVIVANTES ONT DEMANDÉ ══════════════════════════

test('⑥a la sonde du maillage ÉCRÊTE la mer comme le maillage, pas comme la sonde', () => {
  // ⛔ **UNE SURVIVANTE A TROUVÉ CE TROU.** `altitudeMaillage` rend
  // `Math.max(h, 0)` quand aucun fond n'est posé (« oceans stay on the sphere »),
  // `altitudeSonde` rend la valeur BRUTE, négatifs du terrarium compris. Une
  // paroi posée sur la seconde passerait SOUS sa propre surface tout le long
  // d'un littoral — c'est le §4 de `parois-crop.js`, dans l'autre sens.
  const g = globePourSondes({ f: () => -500 })
  const t = g.tuile
  const { lat, lon } = tileToLatLon(t.x + 0.4, t.y + 0.6, t.z)
  const liste = g.tuilesAvecHauteurs()
  assert.equal(g.hauteurDessinee(lat, lon, liste), 0, 'le maillage écrête la mer à zéro')
  assert.ok(g.hauteurSurface(lat, lon, liste) < -400, 'la sonde, elle, rend le brut')
})

test('⑥b le FOND MARIN est lu AU NŒUD, pas au point demandé', () => {
  // ⛔ **UNE SURVIVANTE ENCORE.** `_buildMesh` interroge le champ du fond à la
  // position de CHAQUE SOMMET ; lire le fond au point demandé rendrait un fond
  // CONSTANT sur toute la cellule — une seconde loi, qui diverge de la première
  // dès que le fond a du relief. La tuile est toute en mer, donc c'est le champ
  // qui décide, et lui seul.
  // ⚠️ **LE CHAMP DOIT ÊTRE PLUS FIN QUE LE MAILLAGE, SINON LES DEUX LOIS SONT
  // LA MÊME.** `echantillonnerFond` est bilinéaire : sur une cellule de maillage
  // qui tient DANS une cellule de champ, l'interpolation des nœuds rend le point
  // exactement (mesuré : 2·10⁻⁹ d'écart). Le champ fait donc 129 nœuds pour les
  // 24 quads de la tuile, et il ondule.
  const cote = 129
  const g = globePourSondes({ f: () => -1 })
  const t = g.tuile
  const centre = tileToLatLon(t.x + 0.5, t.y + 0.5, t.z)
  const repere = repereCrop({ centre, zoom: t.z, tuilesParBloc: 1 })
  const valeurs = new Float32Array(cote * cote)
  for (let j = 0; j < cote; j++) for (let i = 0; i < cote; i++) valeurs[j * cote + i] = -900 - 800 * Math.sin(i * 1.9) * Math.cos(j * 2.3)
  g._fondCrop = { valeurs, cote, repere, portee: 0.5, bathy: true, profMaxM: 3400 }
  const G = segmentsTuile(t.z)
  const liste = g.tuilesAvecHauteurs()
  // un point au MILIEU d'une cellule : la loi doit rendre l'interpolation des
  // NŒUDS, jamais le fond du point lui-même.
  const { lat, lon } = tileToLatLon(t.x + 6.5 / G, t.y + 6.5 / G, t.z)
  const rendu = g.hauteurDessinee(lat, lon, liste)
  const auNoeud = (i, j) => {
    const p = tileToLatLon(t.x + i / G, t.y + j / G, t.z)
    return g.hauteurDessinee(p.lat, p.lon, liste)
  }
  const attendu = interpolerMaille(6.5 / G, 6.5 / G, G, auNoeud)
  assert.ok(Math.abs(rendu - attendu) < 1e-6, rendu + ' contre ' + attendu)
  // ⚠️ **ET LE TÉMOIN : LE FOND DU POINT LUI-MÊME EST DIFFÉRENT.** Sans lui, ce
  // test serait vert sur les deux lois.
  const auPoint = Math.min(echantillonnerFond(g._fondCrop, lat, lon), 0)
  assert.ok(Math.abs(auPoint - rendu) > 5, 'les deux lois ne se distinguent pas (' + auPoint + ' contre ' + rendu + ')')
})

test('⑥c la surface que `_buildMesh` POSE est EXACTEMENT celle que `hauteurDessinee` REND', () => {
  // ⚡ **C'EST L'INVARIANT SUR LEQUEL TOUTE LA TÂCHE REPOSE, ET IL APPARIE LES
  // DEUX CÔTÉS.** ③a comparait la géométrie à `interpolerMaille` avec un `G`
  // choisi par le TEST : une mutation qui changeait la grille d'UN SEUL des deux
  // côtés y survivait. Ici les deux lectures viennent du dépôt, et la moindre
  // divergence de grille, de loi de nœud ou de diagonale tue.
  const z = 12, tx = 2094, ty = 2270
  const { heights, size } = tuileFactice()
  const t = { z, x: tx, y: ty, heights, size, texture: null, chord: 0.15, key: z + '/' + tx + '/' + ty }
  const faux = {
    exaggeration: 2,
    _fondCrop: null,
    group: { add() {} },
    _materialFor: () => ({}),
    _retaillerJupe: () => false,
    tiles: new Map([[t.key, t]]),
    // ⚠️ **UNE COPIE, PARCE QUE `_buildMesh` RELÂCHE `t.heights`** (256 Kio par
    // tuile, 105 Mo à 420 tuiles en cache — son commentaire le dit). La sonde,
    // elle, les relit : dans l'application elle tourne AVANT la libération.
    tuilesAvecHauteurs: () => [{ ...t, heights }],
    hauteurDessinee: Globe.prototype.hauteurDessinee,
    _tuileLaPlusFine: Globe.prototype._tuileLaPlusFine,
  }
  Globe.prototype._buildMesh.call(faux, t)
  const pos = t.mesh.geometry.attributes.position.array
  const G = segmentsTuile(z)
  const dispScale = (R_GLOBE / EARTH_RADIUS_M) * faux.exaggeration
  const liste = faux.tuilesAvecHauteurs()
  const P = (s) => [pos[s * 3] + t.mesh.position.x, pos[s * 3 + 1] + t.mesh.position.y, pos[s * 3 + 2] + t.mesh.position.z]
  let pire = 0
  // ⚠️ **LES NŒUDS DE BORD `i = G` OU `j = G` NE SONT PAS TESTÉS, ET C'EST UNE
  // CONVENTION DU DÉPÔT, PAS UN OUBLI** : ils tombent exactement sur `tx + 1`,
  // c'est-à-dire dans la tuile VOISINE, et `_tuileLaPlusFine` la leur attribue
  // (l'intervalle est semi-ouvert, `tx < 1`). Les deux tuiles y lisent leur
  // propre texel de bord — la couture de niveau que la Tâche K documente déjà.
  for (const [i, j] of [[0, 0], [5, 7], [11, 3], [G - 1, G - 1], [17, 20], [G - 1, 0]]) {
    const { lat, lon } = tileToLatLon(tx + i / G, ty + j / G, z)
    const a = P(j * (G + 1) + i)
    const hGpu = (Math.hypot(a[0], a[1], a[2]) - R_GLOBE) / dispScale
    pire = Math.max(pire, Math.abs(hGpu - faux.hauteurDessinee(lat, lon, liste)))
  }
  assert.ok(pire < 0.02, "la sonde s'écarte des SOMMETS de " + pire + ' m')
  // et au MILIEU des cellules, où l'interpolation travaille
  for (const [i, j] of [[5, 7], [11, 3], [17, 20]]) {
    for (const [su, sv] of [[0.25, 0.25], [0.5, 0.5], [0.9, 0.9]]) {
      const { lat, lon } = tileToLatLon(tx + (i + su) / G, ty + (j + sv) / G, z)
      const a = P(j * (G + 1) + i), b = P(j * (G + 1) + i + 1)
      const c = P((j + 1) * (G + 1) + i), d = P((j + 1) * (G + 1) + i + 1)
      const gpu = su + sv <= 1
        ? [0, 1, 2].map((k) => a[k] + su * (b[k] - a[k]) + sv * (c[k] - a[k]))
        : [0, 1, 2].map((k) => d[k] + (1 - su) * (c[k] - d[k]) + (1 - sv) * (b[k] - d[k]))
      const hGpu = (Math.hypot(gpu[0], gpu[1], gpu[2]) - R_GLOBE) / dispScale
      pire = Math.max(pire, Math.abs(hGpu - faux.hauteurDessinee(lat, lon, liste)))
    }
  }
  assert.ok(pire < 0.02, "la sonde s'écarte de la SURFACE de " + pire + ' m')
})

test('⑤c la paroi appelle la sonde AVEC LA LATITUDE EN PREMIER, et ne refait pas la liste', () => {
  // ⛔ **DEUX SURVIVANTES DANS UN SEUL TEST.** ⑤a comptait les appels ; il ne
  // regardait ni leurs ARGUMENTS (lat et lon échangés survivaient) ni le nombre
  // de fois que la LISTE de tuiles était rebâtie (l'anneau fait plus de mille
  // points, et `this.tiles` peut porter 1 700 entrées : deux millions
  // d'itérations pour une géométrie bâtie à l'arrêt).
  const { heights, size } = tuileFactice()
  const z = 12, tx = 2094, ty = 2270
  const t = { z, x: tx, y: ty, heights, size, key: z + '/' + tx + '/' + ty }
  const { lat, lon } = tileToLatLon(tx + 0.5, ty + 0.5, z)
  const repere = repereCrop({ centre: { lat, lon }, zoom: z, tuilesParBloc: 1 })
  const vus = []
  let nListe = 0
  const faux = {
    _crop: repere,
    _fondCrop: null,
    _parois: null,
    _baseYCrop: null,
    exaggeration: 2,
    tiles: new Map([[t.key, t]]),
    tuilesAvecHauteurs: () => { nListe++; return [t] },
    uniforms: { uCropCoin: { value: 0.08 }, uCropCoinN: { value: 4.4 } },
    group: { add() {}, remove() {} },
    hauteurDessinee(la, lo, liste) { vus.push([la, lo]); return Globe.prototype.hauteurDessinee.call(this, la, lo, liste) },
    _tuileLaPlusFine: Globe.prototype._tuileLaPlusFine,
    _retaillerJupes: () => 0,
  }
  try {
    Globe.prototype.construireParoisCrop.call(faux, {})
  } catch {
    // la géométrie three peut ne pas se monter dans ce stub ; ce qui compte est
    // ce qui a été APPELÉ avant, et l'anneau est bâti en tout premier
  }
  assert.ok(vus.length > 500, 'la sonde a été appelée ' + vus.length + ' fois')
  // ⚡ **L'ORDRE DES ARGUMENTS, PROUVÉ CONTRE `latLonDeLocal` DU DÉPÔT.**
  const anneau = contourCrop(0.08, 4.4, PAS_CONTOUR)
  const attendu = latLonDeLocal(anneau[0].u, anneau[0].v, repere)
  assert.ok(Math.abs(vus[0][0] - attendu.lat) < 1e-9, 'premier argument ' + vus[0][0] + ', latitude attendue ' + attendu.lat)
  assert.ok(Math.abs(vus[0][1] - attendu.lon) < 1e-9, 'second argument ' + vus[0][1] + ', longitude attendue ' + attendu.lon)
  // ⚠️ **ET LE TÉMOIN : LES DEUX NE SONT PAS INTERCHANGEABLES ICI.**
  assert.ok(Math.abs(attendu.lat - attendu.lon) > 1, 'lat et lon trop proches — le test ne prouverait rien')
  // ⚠️ **LA LISTE EST PRÉ-FILTRÉE UNE FOIS, ET C'EST ÉCRIT DANS LE DÉPÔT.**
  assert.equal(nListe, 1, 'la liste de tuiles a été rebâtie ' + nListe + ' fois')
})

test('⑥d le FOND MARIN entre bien dans la sonde du maillage — la mer, pas la sphère', () => {
  // ⛔ **UNE SURVIVANTE ENCORE, ET ⑥b NE POUVAIT PAS LA VOIR** : il comparait la
  // sonde À ELLE-MÊME (l'attendu était construit avec `hauteurDessinee` aux
  // nœuds), donc débrancher le fond des DEUX côtés le laissait vert. Ici
  // l'attendu est un NOMBRE, et il vient du champ.
  const cote = 5
  const g = globePourSondes({ f: () => -1 })
  const t = g.tuile
  const centre = tileToLatLon(t.x + 0.5, t.y + 0.5, t.z)
  const repere = repereCrop({ centre, zoom: t.z, tuilesParBloc: 1 })
  const liste = g.tuilesAvecHauteurs()
  const { lat, lon } = tileToLatLon(t.x + 0.5, t.y + 0.5, t.z)
  // sans fond, la tuile dit « mer » et `altitudeMaillage` la pose SUR la sphère
  assert.equal(g.hauteurDessinee(lat, lon, liste), 0)
  g._fondCrop = { valeurs: new Float32Array(cote * cote).fill(-1500), cote, repere, portee: 0.5, bathy: true, profMaxM: 1500 }
  assert.ok(Math.abs(g.hauteurDessinee(lat, lon, liste) + 1500) < 1e-6,
    'avec un fond posé, la paroi doit descendre AVEC la surface : ' + g.hauteurDessinee(lat, lon, liste))
})
