// L'ÉCHANTILLONNEUR DE SOL EN ESPACE GLOBE — Tâche D16-b, étapes 1 à 3.
//
// ══════════ CE QUE CE FICHIER GARDE ═════════════════════════════════════════
//
//   ① LA CONVERSION VERTICALE, ET SON ORIGINE. `terrain.sample` ne rend pas des
//      mètres : il rend `(altitude − meanM) × echelle`. Oublier `meanM` pose la
//      cartographie ~1 800 m trop bas sous les Alpes, en silence.
//   ② LE REPLI. `null` de couverture retombe sur le SOL DU BLOC, jamais sur
//      zéro — zéro est le niveau de la mer.
//   ③ LA POSE. Un point posé à la hauteur que le globe vient de rendre tombe
//      SUR la sphère de relief, au mètre près, pas à côté.
//   ④ LA CONVERSION HORIZONTALE EST UNE RÉCIPROQUE, PAS UN FACTEUR — aller et
//      retour sur le même `dem`, à l'arrondi près.
//   ⑤ LE CONTRÔLE DE SIMILITUDE. `echelleGlobe / echelleBloc` DOIT valoir le
//      `k` de `frontiere-rendu.js`. C'est ce qui attrape une exagération
//      désaccordée entre le bloc et le globe.
//   ⑥ LES CALQUES SONT DANS LA SCÈNE QUI EST RENDUE, ET VISIBLES. C'est la
//      cause ① du défaut d'Adrien : `scene.add(this.group)` visait la scène du
//      bloc plat, que la Tâche D16-a ne dessine plus.
//   ⑦ LE PLANCHER DE ZOOM NE COMMANDE PAS LA PRÉSENCE DE L'EAU. `OSM_MIN_ZOOM`
//      choisit une SOURCE ; sous lui, Natural Earth couvre le monde entier.
//
// ⚠️ ⑥ et ⑦ se lisent sur le TEXTE des fichiers : aucun test de ce dépôt ne
// charge `main.js`, et les calques ont besoin d'un contexte WebGL.

import test from 'node:test'
import assert from 'node:assert/strict'
import { readFileSync } from 'node:fs'

import { poseurPlat, creerPoseurGlobe, kAttendu } from '../src/monde/sol-globe.js'
import { facteurEchelle } from '../src/monde/frontiere-rendu.js'
import { latLonToWorld, worldToLatLon, R_GLOBE, EARTH_RADIUS_M, latLonToSphere, demSpan } from '../src/geo.js'
import { TERRAIN_SIZE } from '../src/terrain.js'

// ⚠️ **ON RETIRE LES COMMENTAIRES AVANT DE LIRE LE CODE.** Ces fichiers
// CITENT en prose le geste qu'ils ont abandonné (« il faisait
// `scene.add(this.group)` ») — une assertion qui compterait les citations serait
// rouge sur une explication et verte sur un vrai retour en arrière.
const sansCommentaires = (t) => t.replace(/\/\/[^\r\n]*/g, '')
const lire = (f) => sansCommentaires(readFileSync(new URL(f, import.meta.url), 'utf8'))
const MAIN = lire('../src/main.js')
const WATER = lire('../src/map/water-layer.js')
const PLACES = lire('../src/map/places-layer.js')
const MANAGER = lire('../src/map/layer-manager.js')

// Un MNT de papier — trois tuiles z12 autour de Chamonix, aux conventions de
// `dem.js` (`originTileX/Y` entiers, `size = tuiles × tilePx`).
function demChamonix() {
  const zoom = 12
  const lat = 45.9237, lon = 6.8694
  const n = 2 ** zoom
  const tx = Math.floor(((lon + 180) / 360) * n)
  const la = (lat * Math.PI) / 180
  const ty = Math.floor(((1 - Math.log(Math.tan(la) + 1 / Math.cos(la)) / Math.PI) / 2) * n)
  return {
    zoom,
    originTileX: tx - 1,
    originTileY: ty - 1,
    tilePx: 256,
    size: 768,
    // 3 tuiles z12 à 45,9° : 3 × 256 × 156543,034 × cos(lat) / 2^12
    extentMeters: (3 * 256 * 156543.03392 * Math.cos(la)) / 2 ** zoom,
    meanM: 1830,
    lat,
    lon,
  }
}

const EXAG = 2.2
const dem = demChamonix()
const ECHELLE_BLOC = (demSpan(dem) / dem.extentMeters) * EXAG // unités de bloc par mètre

// ═══════════════════════════════════ ① la conversion verticale et son origine

test('① le zéro du bloc est l’altitude MOYENNE, pas le niveau de la mer', () => {
  const p = creerPoseurGlobe({
    sample: () => 0,
    hauteurM: () => 2400,
    versLatLon: (x, z) => worldToLatLon(dem, x, z),
    echelleBloc: ECHELLE_BLOC,
    meanM: dem.meanM,
    exagerationGlobe: EXAG,
  })
  // 2 400 m réels, sur un bloc dont la moyenne est 1 830 m → +570 m au-dessus
  // du zéro du bloc, converti à l'échelle du bloc.
  assert.ok(Math.abs(p.hauteur(0, 0) - (2400 - 1830) * ECHELLE_BLOC) < 1e-9)
  // ⛔ LA MUTATION QUI COMPTE : `meanM = 0` poserait la carte 1 830 m trop bas.
  const sansMoyenne = creerPoseurGlobe({
    sample: () => 0,
    hauteurM: () => 2400,
    versLatLon: (x, z) => worldToLatLon(dem, x, z),
    echelleBloc: ECHELLE_BLOC,
    meanM: 0,
    exagerationGlobe: EXAG,
  })
  const ecartM = (sansMoyenne.hauteur(0, 0) - p.hauteur(0, 0)) / ECHELLE_BLOC
  assert.ok(Math.abs(ecartM - 1830) < 1e-6, `l’oubli de meanM vaut ${ecartM} m — il doit être visible`)
})

test('① aller-retour mètres ↔ unités de bloc', () => {
  const p = creerPoseurGlobe({
    sample: () => 0, hauteurM: () => null, versLatLon: (x, z) => worldToLatLon(dem, x, z),
    echelleBloc: ECHELLE_BLOC, meanM: dem.meanM, exagerationGlobe: EXAG,
  })
  for (const hM of [-400, 0, 1830, 4808]) {
    assert.ok(Math.abs(p.metresDe(p.blocDe(hM)) - hM) < 1e-6)
  }
})

// ═══════════════════════════════════════════════════════════════════ ② le repli

test('② une couverture manquante retombe sur le SOL DU BLOC, jamais sur zéro', () => {
  const p = creerPoseurGlobe({
    sample: () => 7.25, // le sol du bloc, en unités de bloc
    hauteurM: () => null, // le globe ne sait pas
    versLatLon: (x, z) => worldToLatLon(dem, x, z),
    echelleBloc: ECHELLE_BLOC, meanM: dem.meanM, exagerationGlobe: EXAG,
  })
  assert.equal(p.hauteur(3, -4), 7.25)
  assert.equal(p.refus, 1, 'le refus doit se COMPTER, sinon on ne peut pas dire à quel point ça a manqué')
  assert.notEqual(p.hauteur(0, 0), 0, 'zéro est le niveau de la mer, pas « je ne sais pas »')
})

test('② NaN est traité comme une absence, pas propagé dans la géométrie', () => {
  const p = creerPoseurGlobe({
    sample: () => 1.5, hauteurM: () => NaN, versLatLon: (x, z) => worldToLatLon(dem, x, z),
    echelleBloc: ECHELLE_BLOC, meanM: dem.meanM, exagerationGlobe: EXAG,
  })
  assert.equal(p.hauteur(0, 0), 1.5)
})

// ═══════════════════════════════════════════════════════════════════ ③ la pose

test('③ un point posé à la hauteur rendue tombe SUR la surface du globe, au mètre près', () => {
  const H = 2400
  const p = creerPoseurGlobe({
    sample: () => 0, hauteurM: () => H, versLatLon: (x, z) => worldToLatLon(dem, x, z),
    echelleBloc: ECHELLE_BLOC, meanM: dem.meanM, exagerationGlobe: EXAG,
  })
  const w = latLonToWorld(dem, dem.lat, dem.lon)
  const v = p.placer(w.x, w.z, p.hauteur(w.x, w.z))
  const rayonVoulu = R_GLOBE + H * (R_GLOBE / EARTH_RADIUS_M) * EXAG
  const rayonObtenu = Math.hypot(v.x, v.y, v.z)
  // 1 m converti en unités de globe — la tolérance est une VRAIE longueur.
  const unMetre = (R_GLOBE / EARTH_RADIUS_M) * EXAG
  assert.ok(Math.abs(rayonObtenu - rayonVoulu) < unMetre, `écart ${(rayonObtenu - rayonVoulu) / unMetre} m`)
  // et il est au bon endroit de la sphère, pas seulement au bon rayon
  const attendu = latLonToSphere(dem.lat, dem.lon, rayonVoulu)
  assert.ok(Math.hypot(v.x - attendu.x, v.y - attendu.y, v.z - attendu.z) < unMetre)
})

test('③ une marge en unités de BLOC devient la bonne longueur en mètres', () => {
  const p = creerPoseurGlobe({
    sample: () => 0, hauteurM: () => 1830, versLatLon: (x, z) => worldToLatLon(dem, x, z),
    echelleBloc: ECHELLE_BLOC, meanM: dem.meanM, exagerationGlobe: EXAG,
  })
  const sol = p.placer(0, 0, 0)
  // `offset: 0.07` (water-layer) et `CLEARANCE: 0.9` (places-layer) sont des
  // unités de BLOC. Portées telles quelles en unités de GLOBE, elles vaudraient
  // 4 460 km et 57 000 km — c'est la rivière de 1 465 km du brief.
  for (const [nom, dy] of [['offset eau', 0.07], ['garde des noms', 0.9]]) {
    const haut = p.placer(0, 0, dy)
    const dUnites = Math.hypot(haut.x, haut.y, haut.z) - Math.hypot(sol.x, sol.y, sol.z)
    const dMetres = dUnites / ((R_GLOBE / EARTH_RADIUS_M) * EXAG)
    const attenduM = dy / ECHELLE_BLOC
    assert.ok(Math.abs(dMetres - attenduM) < 1e-6, `${nom} : ${dMetres} m au lieu de ${attenduM} m`)
    // et le garde-fou d'ordre de grandeur : jamais plus de quelques kilomètres
    assert.ok(dMetres < 5000, `${nom} vaut ${Math.round(dMetres)} m — une longueur de bloc lue en unités de globe`)
  }
})

// ═════════════════════════════════════════════ ④ l'horizontale est une réciproque

test('④ bloc → lat/lon → bloc revient au même point, sans facteur d’échelle', () => {
  const half = demSpan(dem) / 2
  let pire = 0
  for (const fx of [-0.9, -0.4, 0, 0.4, 0.9]) {
    for (const fz of [-0.9, -0.4, 0, 0.4, 0.9]) {
      const x = fx * half, z = fz * half
      const g = worldToLatLon(dem, x, z)
      const w = latLonToWorld(dem, g.lat, g.lon)
      pire = Math.max(pire, Math.abs(w.x - x), Math.abs(w.z - z))
    }
  }
  assert.ok(pire < 1e-9, `écart max ${pire} unité de bloc — la réciproque n’en est pas une`)
})

// ══════════════════════════════════════════════ ⑤ le contrôle de similitude

test('⑤ echelleGlobe / echelleBloc EST le k de la similitude', () => {
  const p = creerPoseurGlobe({
    sample: () => 0, hauteurM: () => 0, versLatLon: (x, z) => worldToLatLon(dem, x, z),
    echelleBloc: ECHELLE_BLOC, meanM: dem.meanM, exagerationGlobe: EXAG,
  })
  const k = facteurEchelle({ extentMeters: dem.extentMeters, span: TERRAIN_SIZE })
  assert.ok(Math.abs(p.rapportSimilitude() / k - 1) < 1e-12, `${p.rapportSimilitude()} contre ${k}`)
  // deuxième chemin, indépendant de frontiere-rendu.js
  assert.ok(Math.abs(kAttendu({ extentMeters: dem.extentMeters, span: TERRAIN_SIZE }) / k - 1) < 1e-12)
})

test('⑤ une exagération DÉSACCORDÉE entre bloc et globe se voit dans le rapport', () => {
  const p = creerPoseurGlobe({
    sample: () => 0, hauteurM: () => 0, versLatLon: (x, z) => worldToLatLon(dem, x, z),
    echelleBloc: ECHELLE_BLOC, meanM: dem.meanM, exagerationGlobe: EXAG * 2,
  })
  const k = facteurEchelle({ extentMeters: dem.extentMeters, span: TERRAIN_SIZE })
  assert.ok(Math.abs(p.rapportSimilitude() / k - 2) < 1e-12, 'le désaccord doit être MESURABLE, pas muet')
})

// ═══════════════════════════ ⑥ les calques sont dans la scène qui est rendue

test('⑥ les calques ne s’ajoutent plus eux-mêmes à une scène : c’est le gérant qui la pose', () => {
  // ⛔ LA CAUSE ① DU DÉFAUT D'ADRIEN : `scene.add(this.group)` visait la scène
  // du bloc plat, que la Tâche D16-a ne dessine plus. Les couches n'étaient pas
  // cachées, elles étaient dessinées dans un tampon que plus personne ne regarde.
  assert.equal(/scene\.add\(this\.group\)/.test(WATER), false, 'water-layer se rattache encore tout seul')
  assert.equal(/scene\.add\(this\.group\)/.test(PLACES), false, 'places-layer se rattache encore tout seul')
  assert.match(MANAGER, /poserScene/, 'le gérant doit porter le point unique de rattachement')
})

test('⑥ main.js reloge les calques dans la scène du GLOBE sous le drapeau', () => {
  assert.match(MAIN, /mapLayers\.poserScene\(sceneGlobe\)/,
    'sans ce relogement, les calques restent dans la scène que D16-a ne dessine plus')
})

test('⑥ la visibilité de la cartographie ne suit plus le maillage du bloc plat', () => {
  // `vue.socle` est borné à FAUX sous `terre unique` : y accrocher la carto
  // l'éteint à toutes les altitudes. Elle suit `vue.boutons` — « sommes-nous en
  // vue de surface, devant un bloc ».
  const appels = [...MAIN.matchAll(/mapLayers\.setSurfaceVisible\(([^)]*)\)/g)].map((m) => m[1])
  assert.equal(appels.length, 1, `un seul écrivain attendu, ${appels.length} trouvés : ${appels}`)
  assert.equal(appels[0], 'vue.carto', `la carto suit ${appels[0]} — elle doit suivre vue.carto`)
})

// ═══════════════════════════════════════════════════════ ⑦ le plancher de zoom

test('⑦ sous OSM_MIN_ZOOM, l’eau existe quand même — Natural Earth couvre le monde', () => {
  // Le plancher choisit une SOURCE, il ne commande pas la PRÉSENCE. Mesuré à
  // l'écran (`.banc/D16b/avant.json`) : water peuplé à z6, z8, z10 comme à z12.
  assert.match(WATER, /if \(!riverEntries\) riverEntries = await this\._neRiverRings\(bounds, zoom\)/,
    'le repli Natural Earth des rivières a disparu : sous le plancher il n’y aurait plus rien')
  assert.match(WATER, /_neRings\('lakes'/, 'le repli Natural Earth des lacs a disparu')
})
