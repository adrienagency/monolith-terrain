import { spanLon } from './tile-index.js'
import { worldToLatLon, demSpan } from '../geo.js'
import { CELL_SIZES, cellsForBounds, cellPath, mergeCells, emptyPayload, hasCell } from './geo-cells.js'

const _cache = new Map()

// fetch + cache a trimmed layer file (never throws — empty collection on failure)
//
// ⚠️ Chemin HISTORIQUE : ce fichier couvre le MONDE ENTIER (places.json = 2,67 Mo
// servis, 158 474 entrées). Il ne sert plus que de filet de repli quand le
// manifeste de cellules manque. Le chemin normal est loadLayerForBounds().
export function loadLayer(name) {
  if (!_cache.has(name)) {
    _cache.set(name, fetch(`data/map/${name}.json`).then((r) => (r.ok ? r.json() : null)).catch(() => null))
  }
  return _cache.get(name)
}

// ------------------------------------------------------ chargement par emprise
//
// POURQUOI — mesuré en prod le 2026-07-28 : le démarrage à froid tirait
// places.json (2,67 Mo) + lakes.json (935 Ko) EN ENTIER pour n'afficher que les
// quelques dizaines d'entités du bloc courant (~27 km). Le site est statique
// (Netlify, ni serveur ni base) : on ne peut pas demander « juste les noms
// voulus » à une API, donc on pré-découpe en cellules à la construction
// (scripts/build-map-cells.mjs) et on ne tire ici que les 1 à 4 cellules qui
// recouvrent l'emprise. Annecy : 27 Ko au lieu de 2 688 Ko pour places, 2 Ko au
// lieu de 958 Ko pour lakes.

// Plafond du cache de cellules. Une vue en consomme 1 à 4 ; 96 laisse une
// vingtaine de déplacements en mémoire sans laisser un long survol du globe
// accumuler tout places.json cellule par cellule. Éviction FIFO : une promesse
// évincée reste valide pour qui l'attend déjà.
const MAX_CACHED_CELLS = 96
const _cells = new Map()
let _manifest = null

function loadManifest() {
  if (!_manifest) {
    _manifest = fetch('data/map/cells/index.json').then((r) => (r.ok ? r.json() : null)).catch(() => null)
  }
  return _manifest
}

function loadCell(name, key) {
  const id = `${name}/${key}`
  if (!_cells.has(id)) {
    _cells.set(id, fetch(cellPath(name, key)).then((r) => (r.ok ? r.json() : null)).catch(() => null))
    if (_cells.size > MAX_CACHED_CELLS) _cells.delete(_cells.keys().next().value)
  }
  return _cells.get(id)
}

// Charge une couche restreinte à `bounds` (typiquement patchBounds(dem)).
//
// CONTRAT — ne lève JAMAIS. Rend toujours une collection du bon type : un
// tableau pour `places`, une FeatureCollection pour les autres. Une cellule
// absente (404) est simplement ignorée : la carte ne casse pas, il manque au
// pire une portion de calque.
//
// REPLI — si le manifeste est introuvable (déploiement sans cellules, réseau
// coupé) ou si l'emprise dépasse le garde-fou MAX_CELLS, on retombe sur le
// fichier monolithe : la bascule est réversible sans redéployer le code.
export async function loadLayerForBounds(name, bounds) {
  try {
    const size = CELL_SIZES[name]
    if (!size) return (await loadLayer(name)) ?? emptyPayload(name)
    const manifest = await loadManifest()
    const keys = manifest ? cellsForBounds(bounds, size) : null
    if (!keys) return (await loadLayer(name)) ?? emptyPayload(name)
    const wanted = keys.filter((k) => hasCell(manifest, name, k))
    const chunks = await Promise.all(wanted.map((k) => loadCell(name, k)))
    return mergeCells(name, chunks)
  } catch {
    return emptyPayload(name)
  }
}

// lat/lon bbox of the loaded DEM patch, sampled at the 4 corners + edge mids
// (mercator lat is nonlinear, so include edge midpoints), padded a touch.
// ⚠️ LA DEMI-LARGEUR DU CHAMP, PAS CELLE DE LA GÉOMÉTRIE. Sur une emprise 3×3
// le champ fait 168 unités : échantillonner à ±28 ne récolterait les données que
// du bloc CENTRAL, et on défilerait vers des vallées sans un seul nom de village
// — ce qui se lit comme des données manquantes, pas comme une limite de cadre.
// Mesuré à Chamonix z12 : 28 lieux récoltés à ±28 contre 172 à ±84.
//
// ══════════ ⚠️ PAS DE Math.min/Math.max SUR LA LONGITUDE — LE JUMEAU ═════════
//
// C'est RIGOUREUSEMENT le défaut qui a été corrigé dans `demBounds`
// (aerial-layer.js), laissé en place ici une porte plus loin. `worldToLatLon`
// replie l'indice de tuile dans [0, n) : sur une emprise à cheval sur ±180°, les
// neuf points d'échantillonnage ressortent aux DEUX bouts de l'axe, et trier
// rend le COMPLÉMENT de l'emprise — le tour du monde moins le bloc.
//
// MESURÉ aux Fidji (179,97 / −16,85) : 393 à 396° de large, c'est-à-dire PLUS
// QUE LA TERRE. Conséquence en cascade, et elle n'était pas cosmétique :
// `cellsForBounds` dépassait alors `MAX_CELLS` et rendait `null` pour `places`,
// `rivers` et `coastline` — donc REPLI SUR LE FICHIER MONOLITHE, la régression
// de 10,7 Mo que le découpage en cellules avait précisément tuée. Pour `lakes`
// il demandait 36 cellules là où 2 suffisent.
//
// LA CONVENTION, une fois de plus : on RÉCOLTE les bords ouest et est plutôt
// que de les trier. Le bord ouest est le point d'où l'on peut atteindre tous
// les autres en allant VERS L'EST sans faire plus d'un tour ; on le trouve, ici
// aussi, en cherchant le plus grand TROU du cercle des longitudes.
//
// ⚠️ ET LA MARGE SE MESURE SUR `spanLon`, jamais sur `maxLon - minLon` : sur une
// emprise enroulée la soustraction est négative, et la marge se retrancherait au
// lieu de s'ajouter — le bloc ratisserait MOINS large que lui-même.
export function patchBounds(dem) {
  const half = demSpan(dem) / 2
  const pts = []
  for (const fx of [-1, 0, 1]) for (const fz of [-1, 0, 1]) pts.push(worldToLatLon(dem, fx * half, fz * half))

  let minLat = 90, maxLat = -90
  for (const p of pts) { minLat = Math.min(minLat, p.lat); maxLat = Math.max(maxLat, p.lat) }

  // Les bords ouest et est, enroulement compris. Même méthode que
  // `grilleTuiles` en colonnes de tuiles : les longitudes d'une emprise
  // occupent un ARC du cercle, le reste est un seul trou, et le bord ouest est
  // la longitude qui SUIT ce trou.
  const lons = [...new Set(pts.map((p) => p.lon))].sort((a, b) => a - b)
  let ouest = lons[0], est = lons[lons.length - 1]
  if (lons.length > 1) {
    let plusGrandTrou = -1
    for (let i = 0; i < lons.length; i++) {
      const suivant = lons[(i + 1) % lons.length]
      const trou = (((suivant - lons[i]) % 360) + 360) % 360
      if (trou > plusGrandTrou) { plusGrandTrou = trou; est = lons[i]; ouest = suivant }
    }
  }

  const padLat = (maxLat - minLat) * 0.05 + 0.01
  const padLon = spanLon(ouest, est) * 0.05 + 0.01
  // Les longitudes élargies sont ramenées dans [−180, 180] : une marge qui
  // pousse à 180,4° doit ressortir à −179,6°, sinon les consommateurs qui
  // calculent une colonne de cellule sortent de la grille.
  const replie = (lon) => ((((lon + 180) % 360) + 360) % 360) - 180
  return {
    minLat: minLat - padLat, maxLat: maxLat + padLat,
    minLon: replie(ouest - padLon), maxLon: replie(est + padLon),
  }
}

export function featureBBox(f) {
  let minLon = 180, minLat = 90, maxLon = -180, maxLat = -90
  const walk = (c) => {
    if (typeof c[0] === 'number') { minLon = Math.min(minLon, c[0]); maxLon = Math.max(maxLon, c[0]); minLat = Math.min(minLat, c[1]); maxLat = Math.max(maxLat, c[1]) }
    else c.forEach(walk)
  }
  walk(f.geometry.coordinates)
  return [minLon, minLat, maxLon, maxLat]
}

export function bboxOverlap([aMinLon, aMinLat, aMaxLon, aMaxLat], b) {
  return aMinLon <= b.maxLon && aMaxLon >= b.minLon && aMinLat <= b.maxLat && aMaxLat >= b.minLat
}

export function clipToPatch(features, bounds) {
  return features.filter((f) => bboxOverlap(featureBBox(f), bounds))
}

export function filterByZoom(features, zoom) {
  return features.filter((f) => (f.properties?.min_zoom ?? 0) <= zoom)
}
