import { spanLon } from './tile-index.js'
// Découpage géographique des couches Natural Earth en cellules.
//
// POURQUOI. `loadLayer` téléchargeait le fichier monde entier pour n'afficher
// que le contenu du bloc courant (~27 km) : 2,67 Mo servis pour places.json
// (158 474 entrées) et 935 Ko pour lakes.json, à CHAQUE démarrage à froid,
// pour n'en garder ensuite que quelques dizaines d'entités via patchBounds().
// Mesuré en prod : 10,7 Mo / 97 requêtes / 5,7 s. Les deux fichiers pesaient
// 3,6 Mo de ce total. roads/rivers/coastline (13 / 9,9 / 8,8 Mo bruts) passent
// par le même chemin dès qu'un visiteur active le calque.
//
// Le site est 100 % statique (Netlify, pas de serveur, pas de base) : on ne
// peut pas « demander les noms voulus » à une API. La partition géographique
// est donc la seule voie — on pré-découpe à la construction, le client ne tire
// que les 1 à 4 cellules qui recouvrent son emprise.
//
// TAILLES DE CELLULE, mesurées (gzip, cf. scripts/build-map-cells.mjs --stats) :
//
//   couche     taille  fichiers  total déployé   Annecy (une vue)
//   places        2°      3351   2,88 Mo x1,05        27 Ko  (contre 2 688 Ko)
//   lakes        10°       180   1,20 Mo x1,25         2 Ko  (contre   958 Ko)
//   rivers        5°       691   3,14 Mo x1,03        16 Ko
//   coastline     5°       921   2,94 Mo x1,04        10 Ko (Quiberon)
//   roads         5°       713   3,02 Mo x1,08        21 Ko
//
// Pourquoi PAS la même taille partout : les lignes (rivières, côtes, routes)
// se découpent géométriquement, chaque sommet n'est écrit qu'une fois — le
// surcoût est marginal (x1,03-1,08). Les LACS sont des polygones : les
// découper casserait les remplissages et les trous, donc on recopie le
// polygone entier dans chaque cellule que sa bbox touche. À 2° ce serait x2,89
// (la Caspienne recopiée 15 fois) ; à 10° ça retombe à x1,25 et une vue coûte
// toujours 2 Ko parce que les lacs sont rares. À l'inverse places est dense et
// homogène : 10° donnerait 212 Ko sur les Alpes et 619 Ko sur Java, 2° plafonne
// le pire cas du monde à 32 Ko.
//
// Module PUR (aucun fetch) : c'est ici que porte la couverture de test.

// deg de côté par couche — doit diviser 180 et 360 (grille entière)
export const CELL_SIZES = {
  places: 2,
  lakes: 10,
  rivers: 5,
  coastline: 5,
  // ⚠️ PLUS DE `roads` : le calque a quitté le site le 2026-07-29 (Adrien :
  // « très lourd, très mauvais, tu peux le supprimer »), avec ses 12,6 Mo de
  // monolithe. Le cuiseur itère sur CETTE table — retirer la ligne suffit à le
  // sortir du découpage, et le chargeur ne demandera jamais une cellule qu'il
  // ne connaît pas. Les cellules déjà cuites sur un disque de développement
  // sont sans effet : plus personne ne les lit.
}

// Garde-fou : au-delà, on ne mitraille pas le CDN — l'appelant retombe sur le
// fichier monolithe. Une emprise de bloc réelle fait 1 à 4 cellules ; passer
// à 64 signale un bug ailleurs (dem incohérent, vue globe), pas un besoin.
export const MAX_CELLS = 64

const rowsOf = (size) => Math.round(180 / size)
const colsOf = (size) => Math.round(360 / size)

// Indice de cellule. La rangée est serrée dans la grille (lat = +90 exact
// tomberait sur rows) ; la colonne est repliée sur le tore, ce qui absorbe
// d'un coup lon = +180 et les longitudes qui débordent (patchBounds ajoute un
// padding qui peut pousser à 180,4).
export function cellIndex(size, lat, lon) {
  const rows = rowsOf(size)
  const cols = colsOf(size)
  const row = Math.min(rows - 1, Math.max(0, Math.floor((lat + 90) / size)))
  const col = (((Math.floor((lon + 180) / size) % cols) + cols) % cols)
  return { row, col }
}

export function cellKey(size, lat, lon) {
  const { row, col } = cellIndex(size, lat, lon)
  return `${row}_${col}`
}

// Imbriqué par rangée : 3 351 fichiers plats dans un seul dossier ralentissent
// git, l'explorateur et le téléversement Netlify.
export function cellPath(name, key) {
  const [row, col] = key.split('_')
  return `data/map/cells/${name}/${row}/${col}.json`
}

// Cellules recouvrant une emprise. Rend `null` si l'emprise en demande plus
// que MAX_CELLS (l'appelant bascule alors sur le fichier monolithe).
//
// ══════════ ⚠️ ANTIMÉRIDIEN : LE SIGNE, PLUS L'HEURISTIQUE DES 180° ═════════
//
// L'ANCIENNE RÈGLE, et pourquoi elle a cessé d'être vraie. `patchBounds` triait
// ses longitudes, si bien qu'un bloc à cheval sur ±180° en ressortait comme
// minLon = −179,9 / maxLon = 179,8 : 359,7° de large, la Terre entière. Faute de
// pouvoir distinguer cette forme d'une vraie emprise, on décrétait qu'« une
// étendue de plus de 180° n'est jamais un vrai bloc » et on prenait le
// complément. C'était une DEVINETTE, et elle a tenu tant que les blocs étaient
// petits.
//
// Elle est fausse depuis le 3×3 avec plancher z3. MESURÉ : une emprise 3×3 fait
// NEUF tuiles de large, soit 202,5° à z4 et 405° à z3 — des étendues parfaitement
// légitimes, que l'heuristique retournait en leur complément. Le jumeau de cette
// ligne dans `bathy-sources.js` refusait pour cette raison la bathymétrie fine
// sur l'Europe en 3×3 z4, et faisait DISPARAÎTRE le crédit EMODnet, que le même
// fichier qualifie d'obligation de licence.
//
// LA RÈGLE MAINTENANT : le SIGNE, pas la largeur. `minLon > maxLon` veut dire
// « l'emprise franchit ±180° » — c'est la convention que `tilesForBBox` respecte
// depuis toujours, que `demBounds` respecte depuis sa correction, et que
// `patchBounds` respecte depuis la sienne. Plus personne ne produit la forme
// triée, donc plus rien à deviner.
export function cellsForBounds(bounds, size) {
  if (!bounds || !Number.isFinite(bounds.minLat) || !Number.isFinite(bounds.maxLat)) return null
  if (!Number.isFinite(bounds.minLon) || !Number.isFinite(bounds.maxLon)) return null
  const rows = rowsOf(size)
  const cols = colsOf(size)

  const rowLo = cellIndex(size, Math.min(bounds.minLat, bounds.maxLat), 0).row
  const rowHi = cellIndex(size, Math.max(bounds.minLat, bounds.maxLat), 0).row

  // `spanLon` porte la convention : ≥ 0 toujours, et l'enroulement compris.
  const span = spanLon(bounds.minLon, bounds.maxLon)
  let lonLo = bounds.minLon
  let lonHi = bounds.minLon + span
  // Une emprise qui fait au moins le tour du monde ne demande qu'un tour : le
  // plancher z3 en 3×3 en fait 405°, et redemander 45° deux fois ne servirait
  // qu'à doubler la note. Le garde-fou MAX_CELLS tranchera juste après.
  if (span >= 360) { lonLo = -180; lonHi = 180 - 1e-9 }

  const colStart = Math.floor((lonLo + 180) / size)
  const colEnd = Math.floor((lonHi + 180) / size)
  const nCols = Math.min(cols, colEnd - colStart + 1)
  const nRows = rowHi - rowLo + 1
  if (nRows * nCols > MAX_CELLS) return null

  const keys = []
  const seen = new Set()
  for (let r = rowLo; r <= rowHi && r < rows; r++) {
    for (let i = 0; i < nCols; i++) {
      const col = (((colStart + i) % cols) + cols) % cols
      const k = `${r}_${col}`
      if (seen.has(k)) continue
      seen.add(k)
      keys.push(k)
    }
  }
  return keys
}

export function emptyPayload(name) {
  return name === 'places' ? [] : { type: 'FeatureCollection', features: [] }
}

// Fusionne les cellules chargées. Les entrées nulles (cellule absente, JSON
// illisible) sont ignorées : le contrat « jamais d'exception, collection vide »
// remonte jusqu'ici.
export function mergeCells(name, chunks) {
  const list = Array.isArray(chunks) ? chunks : []
  if (name === 'places') {
    const rows = []
    for (const c of list) if (Array.isArray(c)) rows.push(...c)
    // pickPlaces (place-pick.js) EXIGE un tri par proéminence décroissante :
    // il s'arrête au premier maxN accepté. Concaténer deux cellules casse le
    // tri du fichier d'origine, donc on retrie.
    rows.sort((a, b) => (b?.[3] ?? 0) - (a?.[3] ?? 0))
    return rows
  }
  const features = []
  const seen = new Set()
  for (const c of list) {
    if (!c || !Array.isArray(c.features)) continue
    for (const f of c.features) {
      // `fid` ne marque QUE les features recopiées entières (polygones) : un
      // lac à cheval sur deux cellules serait sinon dessiné deux fois. Les
      // tronçons de lignes découpées n'en portent pas — les dédoublonner
      // ferait un trou dans la rivière.
      const fid = f?.properties?.fid
      if (fid != null) {
        if (seen.has(fid)) continue
        seen.add(fid)
      }
      features.push(f)
    }
  }
  return { type: 'FeatureCollection', features }
}

// ------------------------------------------------------- manifeste binaire
//
// Quelles cellules existent ? Une liste de clés ferait ~18 Ko gzip pour les
// 5 856 cellules des cinq couches, payés à chaque démarrage à froid. Un champ
// de bits sur la grille (bit = rangée*cols + colonne) fait 2 Ko AVANT gzip
// pour places, et se compresse à quelques centaines d'octets. Il évite de
// tirer les cellules océaniques vides (79 % de la grille de places).

const B64 = 'ABCDEFGHIJKLMNOPQRSTUVWXYZabcdefghijklmnopqrstuvwxyz0123456789+/'

export function buildBits(size, keys) {
  const cols = colsOf(size)
  const bytes = new Uint8Array(Math.ceil((rowsOf(size) * cols) / 8))
  for (const k of keys) {
    const [r, c] = k.split('_').map(Number)
    const bit = r * cols + c
    bytes[bit >> 3] |= 1 << (bit & 7)
  }
  let out = ''
  for (let i = 0; i < bytes.length; i += 3) {
    const a = bytes[i], b = bytes[i + 1] ?? 0, c = bytes[i + 2] ?? 0
    const n = (a << 16) | (b << 8) | c
    out += B64[(n >> 18) & 63] + B64[(n >> 12) & 63] + B64[(n >> 6) & 63] + B64[n & 63]
  }
  return out
}

const _decoded = new WeakMap()
function decode(entry) {
  let m = _decoded.get(entry)
  if (m) return m
  const s = entry.bits
  const bytes = new Uint8Array(Math.floor((s.length / 4) * 3))
  for (let i = 0, j = 0; i < s.length; i += 4, j += 3) {
    const n = (B64.indexOf(s[i]) << 18) | (B64.indexOf(s[i + 1]) << 12) | (B64.indexOf(s[i + 2]) << 6) | B64.indexOf(s[i + 3])
    bytes[j] = (n >> 16) & 255; bytes[j + 1] = (n >> 8) & 255; bytes[j + 2] = n & 255
  }
  m = bytes
  _decoded.set(entry, m)
  return m
}

// Optimiste par défaut : un manifeste absent ou incomplet ne doit JAMAIS faire
// disparaître une couche — on tente la requête, un 404 est absorbé plus haut.
export function hasCell(manifest, name, key) {
  const entry = manifest?.layers?.[name]
  if (!entry || typeof entry.bits !== 'string' || !entry.size) return true
  const cols = colsOf(entry.size)
  const [r, c] = key.split('_').map(Number)
  if (!Number.isFinite(r) || !Number.isFinite(c)) return true
  const bit = r * cols + c
  const bytes = decode(entry)
  const byte = bytes[bit >> 3]
  if (byte === undefined) return true
  return (byte & (1 << (bit & 7))) !== 0
}
