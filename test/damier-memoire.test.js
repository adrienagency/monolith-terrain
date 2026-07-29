// LE DAMIER TIENT DANS LA MÉMOIRE DU NAVIGATEUR.
//
// Le damier plein (Le Var isolé, z12, 23 voisines + le centre) mesurait
// **1 824 Mo de tas JS** pour une limite pratique de 2 à 4 Go dans Chrome :
// c'est le risque le plus sérieux du damier, devant la vitesse. Mesure du
// 2026-07-27, Chrome piloté en CDP, Mapterhorn en tuiles 512 px (MNT 1536²),
// mode Naturel, bloc central maillé à 1024.
//
// LA CAUSE, et personne n'a mal réglé quoi que ce soit : les textures sont
// dimensionnées pour le bloc CENTRAL (18,3 sommets par unité-monde) et les
// voisines en héritent avec un maillage 2,7 fois plus grossier. Chaque dalle de
// contexte portait donc des champs 4 à 5 fois plus fins que le relief qui les
// porte. Relevé par dalle voisine (79 Mo, dont 55 Mo dans le tas JS) :
//
//   masque côtier 2048²      16,0 Mo de texture + 16,0 Mo d'ImageData
//   analyse 1536² + mips     12,0 Mo
//   géométrie 385² sommets    9,6 Mo
//   MNT Float32 1536²         9,0 Mo
//   masque de découpe 1024²    4,0 Mo × 3 (texture, canevas, ImageData)
//   masque de mer 1536² R8     2,25 Mo
//   rugosité + bump + rampe    2,13 Mo — IDENTIQUES d'une dalle à l'autre
//
// ⚠️ CE QUE LE TAS COMPTE N'EST PAS CE QUE LA CARTE GRAPHIQUE COMPTE.
// `usedJSHeapSize` ne voit que les tableaux typés : les canevas 2D et les
// textures téléversées vivent ailleurs. Un masque côtier en CanvasTexture pèse
// donc 16 Mo hors tas (le canevas) ET 16 Mo dedans (l'ImageData que la cellule
// garde pour ses polders). Le rapport d'origine n'en comptait qu'un sur trois,
// d'où l'écart entre son total (55 Mo) et le relevé (79 Mo).
//
// Les quatre gestes vérifiés ici. Aucun ne touche au MNT : diviser le MNT
// échangerait de la mémoire contre de la QUALITÉ (il est lu par le processeur
// pour la veille des bateaux et le tracé de la jupe), c'est une décision qui
// n'appartient pas au code.

import { test } from 'node:test'
import assert from 'node:assert/strict'
import { coarsenField, resampleField, analyzeDem } from '../src/terrain-analysis.js'
import { computeTerrainJob } from '../src/terrain-jobs.js'
import { maskUniformity } from '../src/region-mask.js'
import { traceSkirt } from '../src/region-skirt.js'
import { NEIGHBOUR_RES, NEIGHBOUR_COAST_SIZE, NEIGHBOUR_ANALYSIS_SIZE, NEIGHBOUR_SEA_SIZE } from '../src/block-grid.js'
import { TERRAIN_SIZE } from '../src/terrain.js'

// ------------------------------------------------- geste 1 · l'analyse de relief

test('coarsenField moyenne par blocs et divise le côté', () => {
  // 4×4 → 2×2 : chaque sortie est la moyenne de son bloc 2×2
  const src = Float32Array.from([
    1, 3, 10, 10,
    5, 7, 10, 10,
    0, 0, 2, 4,
    0, 0, 6, 8,
  ])
  const out = coarsenField(src, 4, 2)
  assert.equal(out.size, 2)
  assert.deepEqual([...out.data], [4, 10, 0, 5])
})

test('coarsenField au facteur 1 rend la donnée telle quelle', () => {
  const src = Float32Array.from([1, 2, 3, 4])
  const out = coarsenField(src, 2, 1)
  assert.equal(out.size, 2)
  assert.deepEqual([...out.data], [1, 2, 3, 4])
})

test('coarsenField supporte un côté non divisible (bloc de bord tronqué)', () => {
  // 3×3 au facteur 2 → 2×2 ; le dernier bloc n'a qu'un pixel
  const src = Float32Array.from([1, 1, 8, 1, 1, 8, 4, 4, 9])
  const out = coarsenField(src, 3, 2)
  assert.equal(out.size, 2)
  assert.deepEqual([...out.data], [1, 8, 4, 9])
})

test('analyzeDem plafonne le côté de l’analyse et rectifie l’échelle', () => {
  // le champ n'a pas besoin d'être réaliste : c'est la TAILLE de sortie et la
  // mise à l'échelle des rayons (en mètres) que ce test verrouille
  const size = 64
  const data = new Float32Array(size * size)
  for (let i = 0; i < data.length; i++) data[i] = (i % 17) * 3
  const plein = analyzeDem({ data, size, metersPerPixel: 26 })
  assert.equal(plein.size, 64)
  assert.equal(plein.rgba.length, 64 * 64 * 4)

  const reduit = analyzeDem({ data, size, metersPerPixel: 26 }, { maxSize: 32 })
  assert.equal(reduit.size, 32)
  assert.equal(reduit.rgba.length, 32 * 32 * 4)
  // 4 fois moins de pixels : c'est tout le gain, en mémoire comme en CPU
  assert.equal(plein.rgba.length / reduit.rgba.length, 4)
})

test('analyzeDem ne grossit JAMAIS un champ déjà sous le plafond', () => {
  const size = 16
  const data = new Float32Array(size * size)
  const r = analyzeDem({ data, size, metersPerPixel: 26 }, { maxSize: 768 })
  assert.equal(r.size, 16)
})

// ⚠️ LE PLAFOND EST EXACT, et il ne l'a pas toujours été. `coarsenField` ne sait
// diviser que par un ENTIER : demander « au plus 1024 » à un MNT de 1536 prenait
// le facteur 2 et rendait 768 — le MÊME résultat, octet pour octet, qu'un
// plafond de 768. Le MNT de production fait exactement 1536² (Mapterhorn en
// tuiles 512 px), donc remonter la constante sans toucher au rééchantillonnage
// aurait été un correctif qui ne corrige rien tout en se relisant comme
// appliqué. C'est le test qui l'aurait attrapé, et il est ici pour ça.
test('le plafond d’analyse rend la taille DEMANDÉE, même à rapport non entier', () => {
  const size = 1536 // la taille de production, pas un cas d'école
  const data = new Float32Array(size * size)
  for (let i = 0; i < data.length; i++) data[i] = ((i * 37) % 911) * 0.7
  const r = analyzeDem({ data, size, metersPerPixel: 17.8 }, { maxSize: 1024 })
  assert.equal(r.size, 1024, '1536 plafonné à 1024 doit rendre 1024, pas 768')
  assert.notEqual(r.size, analyzeDem({ data, size, metersPerPixel: 17.8 }, { maxSize: 768 }).size)
})

test('resampleField retombe BIT À BIT sur coarsenField quand le rapport est entier', () => {
  const size = 24
  const src = new Float32Array(size * size)
  for (let i = 0; i < src.length; i++) src[i] = Math.sin(i * 0.37) * 900
  for (const [cible, facteur] of [[12, 2], [8, 3], [6, 4]]) {
    const a = resampleField(src, size, cible)
    const b = coarsenField(src, size, facteur)
    assert.equal(a.size, b.size)
    for (let i = 0; i < b.data.length; i++) assert.equal(a.data[i], b.data[i], `cible ${cible}, cellule ${i}`)
  }
})

test('resampleField ne grossit jamais : cible nulle ou trop grande → la source telle quelle', () => {
  const src = Float32Array.from([1, 2, 3, 4])
  assert.equal(resampleField(src, 2, 0).data, src)
  assert.equal(resampleField(src, 2, 2).data, src)
  assert.equal(resampleField(src, 2, 8).data, src)
})

test('resampleField à rapport 3/2 moyenne bien les recouvrements partiels', () => {
  // 3×3 → 2×2, f = 1,5 : la cellule (0,0) couvre [0;1,5)² — quatre sources avec
  // les poids 1, 0,5, 0,5 et 0,25, soit une somme de poids de 2,25.
  const src = Float32Array.from([
    4, 8, 100,
    12, 20, 100,
    100, 100, 100,
  ])
  const r = resampleField(src, 3, 2)
  assert.equal(r.size, 2)
  const attendu = (4 * 1 + 8 * 0.5 + 12 * 0.5 + 20 * 0.25) / 2.25
  assert.ok(Math.abs(r.data[0] - attendu) < 1e-4, `${r.data[0]} ≠ ${attendu}`)
})

// --------------------------------------- geste 2 · le masque de découpe uniforme

test('maskUniformity reconnaît un masque tout blanc, tout noir, et refuse le reste', () => {
  const px = (vals) => Uint8ClampedArray.from(vals.flatMap((v) => [v, v, v, 255]))
  assert.equal(maskUniformity(px([255, 255, 255, 255])), 'full')
  assert.equal(maskUniformity(px([0, 0, 0, 0])), 'empty')
  assert.equal(maskUniformity(px([255, 255, 0, 255])), null)
  // ⚠️ le refus doit être STRICT : une dalle couverte à 99,9 % garde sa texture.
  // Le contre-exemple qui compte est un lac ou une mer intérieure retirés par le
  // clip d'altitude — mesuré sur le Var, deux dalles annoncées « 100 % » par une
  // grille 40×40 ont en réalité des trous de quelques pixels.
  const presqueBlanc = new Uint8ClampedArray(4 * 1000).fill(255)
  presqueBlanc[4 * 500] = 0
  assert.equal(maskUniformity(presqueBlanc), null)
  // une valeur intermédiaire (bord flouté) n'est pas uniforme non plus
  assert.equal(maskUniformity(px([255, 254])), null)
})

test('maskUniformity ne lit que le canal rouge, pas l’alpha', () => {
  // le rasterizer peint en blanc opaque sur noir opaque : seul R porte le bit
  const px = new Uint8ClampedArray([255, 0, 0, 255, 255, 128, 64, 12])
  assert.equal(maskUniformity(px), 'full')
})

// La jupe d'une dalle PLEINE se trace sans masque : c'est ce qui permet de ne
// pas garder son canevas. Elle doit rendre EXACTEMENT ce que rendait le canevas
// tout blanc — aucune ligne de coupe à l'intérieur, mais bien un mur le long des
// quatre bords du carré (sinon la dalle s'ouvrirait en tranche de papier au bord
// du damier) — et son minimum intérieur, qui fixe le pied COMMUN de la découpe.
test('traceSkirt sans masque, dalle PLEINE : aucune coupe intérieure, quatre bords murés', () => {
  const grid = 20
  const t = traceSkirt({ maskCanvas: null, uniform: 'full', sample: () => 42, grid })
  assert.equal(t.interiorMin, 42)
  assert.equal(t.segs.length, 4 * grid, 'un mur par intervalle de bord, sur les quatre côtés')
  const H = TERRAIN_SIZE / 2
  for (const s of t.segs) {
    const surBord = (v) => Math.abs(Math.abs(v) - H) < 1e-9
    assert.ok(surBord(s.ax) || surBord(s.az), 'un segment de dalle pleine est toujours sur un bord')
  }
})

test('traceSkirt sans masque, dalle VIDE : rien du tout', () => {
  const t = traceSkirt({ maskCanvas: null, uniform: 'empty', sample: () => 42, grid: 20 })
  assert.equal(t.segs.length, 0)
  assert.equal(t.interiorMin, Infinity, 'aucun intérieur mesuré : une absence, pas un zéro')
})

test('traceSkirt d’une dalle pleine échantillonne le relief sur toute la dalle', () => {
  // le plancher de la zone est COMMUN à toutes les dalles : une dalle pleine qui
  // ne rendrait pas son point le plus bas ferait remonter le pied de la découpe
  const vus = []
  const t = traceSkirt({
    maskCanvas: null,
    uniform: 'full',
    sample: (x, z) => { vus.push([x, z]); return x < 0 ? 3 : 90 },
    grid: 20,
  })
  assert.equal(t.interiorMin, 3)
  assert.ok(vus.length > 4, 'le relief est bien sondé, pas deviné')
})

// ------------------------------------------- gestes 1 et 4 · les tailles voisines

// ⚠️ CE TEST ÉTAIT PLUS ÉTROIT QUE LE COMMENTAIRE QU'IL VERROUILLAIT.
// block-grid.js proclamait « aucun champ ne dépasse quatre fois la densité du
// maillage qui le porte (test/damier-memoire.test.js le verrouille) » — or le
// test ne connaissait que deux champs sur quatre. Le masque de mer, calculé sur
// le MNT plein, était à 6,00× ; le MNT, lui, est une exception ASSUMÉE mais
// rien ne le disait. Un commentaire juste sur la moitié de ce qu'il annonce est
// pire qu'un commentaire absent : le prochain lecteur ne rouvre pas le dossier.
test('les dalles voisines sont dimensionnées SUR ELLES-MÊMES, pas sur le bloc central', () => {
  // Une voisine couvre 56 unités-monde et porte NEIGHBOUR_RES + 1 sommets sur
  // ce côté. Densités toutes exprimées dans la même unité pour qu'un écart
  // saute aux yeux :
  const parUnite = (n) => n / TERRAIN_SIZE
  const maillage = parUnite(NEIGHBOUR_RES + 1) // 4,59 sommets par unité
  assert.equal(NEIGHBOUR_RES, 256)
  assert.equal(NEIGHBOUR_COAST_SIZE, 1024)
  assert.equal(NEIGHBOUR_ANALYSIS_SIZE, 1024)
  assert.equal(NEIGHBOUR_SEA_SIZE, 1024)
  // TOUTES les textures de la dalle, nommément — pas seulement celles dont on
  // se souvenait. 1024²/56 = 18,29 px/u contre 4,59 sommets/u : 3,99×, donc
  // l'analyse à 1024 ne « casse » rien, elle se pose PILE au niveau du masque
  // côtier, qui y était déjà.
  for (const [nom, taille] of [
    ['masque côtier', NEIGHBOUR_COAST_SIZE],
    ['analyse de relief', NEIGHBOUR_ANALYSIS_SIZE],
    ['masque de mer', NEIGHBOUR_SEA_SIZE],
  ]) {
    const rapport = parUnite(taille) / maillage
    assert.ok(rapport <= 4, `${nom} trop fin pour son maillage : ${rapport.toFixed(2)}×`)
  }
})

// ⚠️ LE MNT EST LA SEULE EXCEPTION, ET ELLE EST DÉLIBÉRÉE. Il est lu par le
// PROCESSEUR (veille devant l'étrave des bateaux, tracé de la jupe de découpe,
// orographie des nuages), pas seulement par la carte graphique : le réduire
// échangerait de la mémoire contre de la QUALITÉ. Le test l'écrit pour que ça
// reste une exception nommée et non une dérive qu'on redécouvre.
test('le MNT, lui, n’est PAS réduit — exception assumée, pas oubli', () => {
  const size = 96
  const dem = { data: new Float32Array(size * size), size, metersPerPixel: 20 }
  for (let i = 0; i < dem.data.length; i++) dem.data[i] = ((i * 13) % 401) - 50
  const got = computeTerrainJob({ ...dem, maxSize: 32, seaMax: 32 })
  // les champs plafonnent…
  assert.equal(got.analysisSize, 32)
  assert.equal(got.seaSize, 32)
  // …et le MNT qu'on lui a donné n'a pas été touché : c'est TOUJOURS le tableau
  // d'origine, à sa taille d'origine, que le fil principal continue de lire.
  assert.equal(dem.data.length, size * size)
  assert.equal(dem.size, 96)
})

// Le masque de mer PLAFONNE VRAIMENT côté travail déporté — la constante ne
// suffit pas, c'est computeTerrainJob qui décide.
test('le masque de mer d’une voisine sort à NEIGHBOUR_SEA_SIZE, pas à la taille du MNT', () => {
  const size = 1536
  const data = new Float32Array(size * size)
  for (let i = 0; i < data.length; i++) data[i] = ((i * 7) % 233) - 30
  const got = computeTerrainJob({ data, size, metersPerPixel: 17.8, seaMax: NEIGHBOUR_SEA_SIZE, withAnalysis: false })
  assert.equal(got.seaSize, NEIGHBOUR_SEA_SIZE)
  // 2,25 Mo → 1,00 Mo par dalle, soit 30 Mo rendus sur un damier plein
  assert.equal(got.sea.length, NEIGHBOUR_SEA_SIZE ** 2)
})

// ---------------------------------------------------------------------------
// geste 5 · LA MÉMOIRE DES BLOCS D'ALTITUDE (src/dem-memo.js)
// ---------------------------------------------------------------------------
//
// Ajoutée pour le retour de zoom : revenir à un zoom déjà vu recalculait
// 609 ms à l'identique (145 ms de fil principal figé pour refaire le MNT,
// 464 ms de travailleur pour refaire l'analyse de relief — mesuré à La Réunion,
// Chrome piloté, séquence z13→z14→z13). Elle S'INSCRIT DONC DANS LA
// COMPTABILITÉ CI-DESSUS, parce qu'elle RETIENT :
//
//   MNT Float32 1536²                                          9,4 Mo / entrée
//   analyse RGBA, taille selon le palier machine
//     palier haut  analysisMax 0 → 1536²                       9,4 Mo / entrée
//     palier moyen analysisMax 1024                            4,2 Mo / entrée
//     iMac 2015    analysisMax 768                             2,4 Mo / entrée
//
// À DEUX entrées : 23,6 Mo sur un iMac 2015, 37,7 Mo au pire (machine haute).
// Contre le pic du damier plein mesuré en tête de fichier — 1 762 Mo — c'est
// 2,1 % au pire. C'est CE RAPPORT qui rend la mémoire défendable, et c'est
// pour ça que la borne est un chiffre fixe et non une heuristique : l'étude
// « fenêtre continue 3×3 » raisonne sur les mêmes budgets et doit pouvoir
// compter dessus.
//
// ⚠️ ET LE DAMIER N'ENTRE PAS DEDANS. block-grid.js tient déjà sa propre
// mémoire de MNT voisins, bornée à 32 Mo : l'y faire entrer compterait ses
// dalles DEUX FOIS et chasserait le bloc central à chaque extension. C'est
// pourquoi la mémorisation est sur DEMANDE (`loadDem({ memo: true })`) et que
// l'analyse d'un MNT non mémorisé n'est tout simplement pas gardée — les deux
// derniers tests de cette section le verrouillent.

import {
  DEM_MEMO_MAX,
  demMemoCle,
  demMemoLire,
  demMemoEcrire,
  demMemoOctets,
  demMemoVider,
  analyseMemoLire,
  analyseMemoEcrire,
} from '../src/dem-memo.js'

const CLE = { source: 'mapterhorn', zoom: 13, maxZoom: 16, ox: 4270, oy: 4680, tilesAcross: 3, tilePx: 512, lat: -21.115, lon: 55.536, bathy: true }
const faussetMnt = (size, graine = 1) => {
  const data = new Float32Array(size * size)
  for (let i = 0; i < data.length; i++) data[i] = ((i * 37 * graine) % 911) * 0.7 - 120
  return { data, size, metersPerPixel: 17.8 }
}

test('mémoire des blocs : la clé rend la même chaîne pour la même zone, et change dès qu’un champ bouge', () => {
  const base = demMemoCle(CLE)
  assert.equal(demMemoCle({ ...CLE }), base)
  for (const champ of ['source', 'zoom', 'maxZoom', 'ox', 'oy', 'tilesAcross', 'tilePx', 'lat', 'lon']) {
    const modifie = { ...CLE, [champ]: typeof CLE[champ] === 'number' ? CLE[champ] + 1 : 'aws' }
    assert.notEqual(demMemoCle(modifie), base, `${champ} doit faire partie de la clé`)
  }
  assert.notEqual(demMemoCle({ ...CLE, bathy: false }), base, 'bathy doit faire partie de la clé')
})

test(`mémoire des blocs : bornée à ${DEM_MEMO_MAX} entrées, MNT ET analyse évincés ensemble`, () => {
  demMemoVider()
  const taille = 96
  const gardes = []
  for (let k = 0; k < DEM_MEMO_MAX; k++) {
    const dem = faussetMnt(taille, k + 1)
    demMemoEcrire(demMemoCle({ ...CLE, zoom: 10 + k }), dem)
    analyseMemoEcrire(dem, 1024, new Uint8ClampedArray(1024 * 1024 * 4), 1024)
    gardes.push(dem)
  }
  const attendu = DEM_MEMO_MAX * (taille * taille * 4 + 1024 * 1024 * 4)
  assert.equal(demMemoOctets(), attendu, 'la comptabilité voit le MNT ET son analyse')

  // une entrée de plus : la plus ancienne part — MNT et analyse d'un bloc
  const deTrop = faussetMnt(taille, 99)
  demMemoEcrire(demMemoCle({ ...CLE, zoom: 10 + DEM_MEMO_MAX }), deTrop)
  assert.equal(demMemoLire(demMemoCle({ ...CLE, zoom: 10 })), null, 'le plus ancien MNT est parti')
  assert.equal(analyseMemoLire(gardes[0], 1024), null, 'et son analyse avec lui — pas d’entrée fantôme')
  assert.ok(demMemoOctets() <= attendu, 'la facture ne peut pas enfler au-delà de la borne')
  demMemoVider()
})

// ⚠️ LE PALIER MACHINE CHANGE `analysisMax` (palier-machine.js sert 0, 1024 ou
// 768). Une analyse cuite à 768² servie à un palier qui en veut 1536² poserait
// un champ quatre fois trop grossier sur le relief, en silence.
test('mémoire des blocs : l’analyse est rangée par plafond de taille, pas en vrac', () => {
  demMemoVider()
  const dem = faussetMnt(64)
  demMemoEcrire(demMemoCle(CLE), dem)
  const a768 = new Uint8ClampedArray(768 * 768 * 4)
  analyseMemoEcrire(dem, 768, a768, 768)
  assert.equal(analyseMemoLire(dem, 768).rgba, a768)
  assert.equal(analyseMemoLire(dem, 1024), null, 'un autre palier ne réutilise pas cette analyse')
  assert.equal(analyseMemoLire(dem, 0), null)
  demMemoVider()
})

// ⚠️ CE QUI AUTORISE LA MÉMORISATION : l'analyse ne dépend QUE des altitudes,
// et pour un même MNT elle rend le même octet. Servir la mémoire au lieu de
// recalculer est donc STRICTEMENT sans effet sur l'image — c'est la seule
// chose qui compte, une accélération qui change un pixel étant un échec.
test('mémoire des blocs : la mémoire rend EXACTEMENT ce que le recalcul rendrait', () => {
  demMemoVider()
  const size = 64
  const dem = faussetMnt(size)
  const calcule = analyzeDem(dem, { maxSize: 32 })
  demMemoEcrire(demMemoCle(CLE), dem)
  analyseMemoEcrire(dem, 32, calcule.rgba, calcule.size)

  const relu = analyseMemoLire(dem, 32)
  const recalcule = analyzeDem(dem, { maxSize: 32 })
  assert.equal(relu.size, recalcule.size)
  assert.equal(relu.rgba.length, recalcule.rgba.length)
  for (let i = 0; i < recalcule.rgba.length; i++) assert.equal(relu.rgba[i], recalcule.rgba[i], `octet ${i}`)
  demMemoVider()
})

// La contrepartie du « le damier n'entre pas dedans » : une dalle voisine dont
// le MNT n'est pas mémorisé ne fait rien peser ici, quoi qu'elle calcule.
test('mémoire des blocs : l’analyse d’un MNT NON mémorisé n’est pas gardée', () => {
  demMemoVider()
  const voisine = faussetMnt(64, 7)
  analyseMemoEcrire(voisine, 1024, new Uint8ClampedArray(1024 * 1024 * 4), 1024)
  assert.equal(analyseMemoLire(voisine, 1024), null)
  assert.equal(demMemoOctets(), 0, 'zéro octet retenu pour une dalle du damier')
})
