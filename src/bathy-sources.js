// `spanLon` vit dans map/tile-index.js, module pur sans dépendance : c'est là que
// la convention d'enroulement est écrite une fois pour toutes.
import { spanLon } from './map/tile-index.js'

// CASCADE DE SOURCES BATHYMÉTRIQUES — quelle source décrit le fond, où, et
// jusqu'à quel zoom.
//
// LA RÈGLE D'ADRIEN, telle qu'elle a été posée : « à chaque fois qu'on a une
// map mieux définie, on l'utilise ; à défaut, on laisse la map GEBCO en soutien
// si on n'a pas de meilleures données. »
//
// Traduit en mécanique, ça donne UN SEUL nombre par endroit du monde : le
// plafond de zoom bathy. Aujourd'hui `src/dem.js` porte une constante globale
// `BATHY_ZMAX = 8`, parce que GEBCO à 15″ ≈ 464 m ne dit rien de plus que z8
// (498 m/px). Là où une source plus fine existe et a été cuite, ce plafond doit
// monter — z10 pour EMODnet à 115 m, z12 pour BlueTopo à 2-16 m — et NULLE PART
// il ne doit descendre.
//
// ─────────────────────────────────────────────────────────── POURQUOI UN INDEX
//
// Le site est 100 % statique (Netlify) : personne ne peut répondre « as-tu du
// fin ici ? ». On pré-calcule donc à la cuisson un `public/data/bathy/index.json`
// de quelques centaines d'octets, et le client lit dedans. C'est exactement le
// motif de `src/map/geo-cells.js` et de son manifeste : un fichier compact qui
// dit ce qui existe, des données par zone, et un repli sur le monde entier.
//
// ────────────────────────────────────────── POURQUOI UN TROU N'EST PAS UN TROU
//
// Une source fine est TOUJOURS trouée : EMODnet rebouche ses vides avec GEBCO,
// et notre propre tuileur n'écrit pas les tuiles sans plateau (filtre SHELF).
// Le plafond par zone n'est donc qu'un POINT DE DÉPART : `loadBathyPatch`
// descend niveau par niveau jusqu'à `BATHY_ZMIN`, et le socle GEBCO reste sur
// ce chemin. Relever le plafond de 8 à 10 n'ajoute que deux essais devant une
// descente qui existe déjà — c'est pourquoi un plafond de zone ne peut jamais
// descendre SOUS le socle (`normalizeIndex` le relève d'office).
//
// ──────────────────────────────────────────────── LA TERRE, ELLE, NE BOUGE PAS
//
// Rien ici ne touche au trait de côte, et c'est structurel, pas une promesse :
// `fuseBathymetry` (src/bathy.js) rend le relief terrarium tel quel dès que le
// pixel est émergé, et la source marine « ne peut que creuser sous le niveau,
// jamais émerger ». Changer de source marine ne peut donc pas déplacer un
// rivage d'un pixel — leçon des polders, payée une session entière.
//
// Module PUR : aucun fetch, aucun DOM. C'est ici que porte la couverture de test.

// Le socle mondial. GEBCO_2026 à 15″ ≈ 464 m ; z8 vaut 498 m/px à 40° de
// latitude, donc cuire z9 depuis GEBCO n'inventerait rien.
export const BATHY_BASE_ZMAX = 8
// Le plancher de repli, inchangé (voir src/dem.js) : le niveau le plus
// grossier, cuit intégralement, qui garantit qu'une tuile fine manquante
// trouve toujours un ancêtre.
export const BATHY_ZMIN = 4

// ────────────────────────────────────────────────────────────── LE CATALOGUE
//
// ⚠️ Les chaînes `credit` sont des OBLIGATIONS DE LICENCE, pas des libellés
// d'interface. Elles sont recopiées mot pour mot depuis les conditions
// d'utilisation de chaque fournisseur. Les reformuler, les traduire ou les
// abréger fait tomber le droit d'usage. Le dossier complet, avec les liens et
// les verdicts : docs/superpowers/plans/2026-07-28-bathymetrie-cotiere.md
//
// `notForNavigation` est vrai pour toutes : les quatre fournisseurs l'exigent
// explicitement, et c'est de toute façon vrai de notre carte.
export const SOURCES = {
  gebco: {
    id: 'gebco',
    label: 'GEBCO_2026',
    // 15 secondes d'arc
    resolutionM: 464,
    license: 'domaine public, usage commercial explicitement autorisé',
    credit:
      'GEBCO Compilation Group (2026) GEBCO_2026 Grid (doi:10.5285/4f68d5c7-45eb-f999-e063-7086abc036fa)',
    url: 'https://www.gebco.net/data-products-gridded-bathymetry-data/gebco2026-grid',
    notForNavigation: true,
  },
  emodnet: {
    id: 'emodnet',
    label: 'EMODnet Bathymetry DTM 2024',
    // 1/16 de minute d'arc = 3,75″ ; vérifié sur le WCS : pas de 0,00104167°
    resolutionM: 115,
    license: 'CC BY 4.0',
    credit:
      'This data product was created by EMODnet and is owned by the EU and licensed under CC BY 4.0.',
    url: 'https://emodnet.ec.europa.eu/en/bathymetry',
    notForNavigation: true,
  },
  bluetopo: {
    id: 'bluetopo',
    label: 'NOAA BlueTopo',
    resolutionM: 16,
    license: 'CC0-1.0',
    // La FAQ NOAA ne réclame rien mais « we appreciate the acknowledgement
    // back to NOAA Coast Survey » — on le fait, c'est gratuit et courtois.
    credit: 'BlueTopo, NOAA Office of Coast Survey (public domain, CC0-1.0)',
    url: 'https://nauticalcharts.noaa.gov/data/bluetopo_faq.html',
    notForNavigation: true,
  },
  copernicus: {
    id: 'copernicus',
    label: 'Copernicus Marine — bathymétrie côtière satellitaire 100 m',
    resolutionM: 100,
    license: 'Copernicus Marine, licence mondiale non exclusive, gratuite et perpétuelle',
    credit:
      'Generated using E.U. Copernicus Marine Service Information; https://doi.org/10.48670/mds-00364',
    url: 'https://data.marine.copernicus.eu/product/BATHYMETRY_GLO_PHY_COASTAL_L4_MY_016_001/description',
    notForNavigation: true,
  },
}

export const NO_NAVIGATION = 'These data are not to be used for navigation.'

// ──────────────────────────────────────────────────────────── longitudes
//
// ⚠️ ANTIMÉRIDIEN. Deux pièges distincts, et ils ne se corrigent pas au même
// endroit (celui-ci a déjà coûté une session sur les cellules géo) :
//
//  1. UNE ZONE peut enjamber ±180 — les Fidji vont de 176°E à 178°O, donc son
//     bbox s'écrit ouest = 176, est = −178, avec ouest > est. Lu naïvement,
//     l'intervalle est vide et la zone n'existe nulle part.
//  2. UNE LONGITUDE peut déborder : `patchBounds` ajoute un padding qui pousse
//     à 180,4°, et le repli de `worldToLatLon` peut rendre −185.
//
// On replie donc TOUT dans [−180, 180) avant de comparer, et on lit un
// intervalle inversé comme un enjambement.
const wrapLon = (lon) => (((lon + 180) % 360) + 360) % 360 - 180

export function spanContainsLon(lon, west, east) {
  const L = wrapLon(lon)
  const W = wrapLon(west)
  // +180 exact doit rester la borne haute d'une zone qui finit au méridien de
  // changement de date, et non retomber sur −180 (ce qui la viderait).
  const E = east === 180 ? 180 : wrapLon(east)
  if (W <= E) return L >= W && L <= E
  // enjambement : la zone est l'UNION des deux bouts de l'axe
  return L >= W || L <= E
}

// ─────────────────────────────────────────────────────────── normalisation
//
// Optimiste par principe, comme `hasCell` : un index absent, périmé ou abîmé ne
// doit JAMAIS faire disparaître la bathymétrie — il doit rendre exactement le
// comportement d'avant l'index, c'est-à-dire z8 partout. C'est ce qui permet de
// déployer le code avant les données, et de survivre à un index oublié dans un
// déploiement partiel.
export function normalizeIndex(raw) {
  const base = {
    source: raw?.base?.source ?? 'gebco',
    zmax: Number.isFinite(raw?.base?.zmax) ? Math.trunc(raw.base.zmax) : BATHY_BASE_ZMAX,
  }
  const zmin = Number.isFinite(raw?.zmin) ? Math.trunc(raw.zmin) : BATHY_ZMIN
  const list = Array.isArray(raw?.zones) ? raw.zones : []
  const zones = []
  for (const z of list) {
    const bbox = z?.bbox
    if (!Array.isArray(bbox) || bbox.length !== 4 || !bbox.every(Number.isFinite)) continue
    if (!Number.isFinite(z?.zmax)) continue
    const [west, south, east, north] = bbox
    if (south > north) continue
    zones.push({
      id: String(z.id ?? z.source ?? 'zone'),
      source: String(z.source ?? 'inconnue'),
      // ⚠️ un plafond de zone ne peut qu'AJOUTER des niveaux : le relever au
      // socle est ce qui garantit qu'une zone mal cuite ne creuse pas un trou
      // dans une carte qui marchait.
      zmax: Math.max(base.zmax, Math.trunc(z.zmax)),
      west,
      south,
      east,
      north,
    })
  }
  // Du plus fin au plus grossier : `zoneAt` prend alors simplement le premier
  // qui couvre, sans dépendre de l'ordre du fichier.
  zones.sort((a, b) => b.zmax - a.zmax)
  return { version: Number(raw?.version) || 1, base, zmin, zones }
}

const asIndex = (index) =>
  index && Array.isArray(index.zones) && index.base ? index : normalizeIndex(index)

const zoneHasPoint = (z, lat, lon) =>
  lat >= z.south && lat <= z.north && spanContainsLon(lon, z.west, z.east)

// ────────────────────────────────────────────────────────────── interrogation

// La zone GAGNANTE pour un point : la plus fine qui le couvre, ou `null` si
// personne — auquel cas c'est le socle qui sert, et c'est très bien.
export function zoneAt(index, lat, lon) {
  const idx = asIndex(index)
  if (!Number.isFinite(lat) || !Number.isFinite(lon)) return null
  for (const z of idx.zones) if (zoneHasPoint(z, lat, lon)) return z
  return null
}

// La cascade complète, du plus fin au socle. Sert au débogage, à l'affichage
// des crédits et à expliquer une carte : « ici on lit BlueTopo, sinon
// Copernicus, sinon GEBCO ». Le dernier maillon est TOUJOURS le socle — c'est
// lui qui interdit le trou.
export function cascadeAt(index, lat, lon) {
  const idx = asIndex(index)
  const out = []
  if (Number.isFinite(lat) && Number.isFinite(lon)) {
    for (const z of idx.zones) if (zoneHasPoint(z, lat, lon)) out.push(z)
  }
  out.push({ id: 'base', source: idx.base.source, zmax: idx.base.zmax })
  return out
}

// LE nombre qui remplace la constante `BATHY_ZMAX` de src/dem.js.
export function bathyMaxZoom(index, lat, lon) {
  const idx = asIndex(index)
  return zoneAt(idx, lat, lon)?.zmax ?? idx.base.zmax
}

// ─────────────────────────────────────────────────────────────── par tuile
const y2lat = (y, z) => (Math.atan(Math.sinh(Math.PI * (1 - (2 * y) / 2 ** z))) * 180) / Math.PI
const x2lon = (x, z) => (x / 2 ** z) * 360 - 180

// Plafond pour une tuile XYZ, mesuré à son CENTRE. `loadBathyPatch` raisonne en
// coordonnées de tuile : c'est l'entrée naturelle du câblage.
//
// Le x est replié sur le tore (le damier calcule déjà `(cx + dx + n) % n`, mais
// un appelant plus haut peut passer un x brut) ; un y hors monde n'existe pas
// en Mercator et retombe sur le socle plutôt que de produire un NaN.
export function tileMaxZoom(index, z, x, y) {
  const idx = asIndex(index)
  const n = 2 ** z
  if (!Number.isFinite(x) || !Number.isFinite(y) || y < 0 || y >= n) return idx.base.zmax
  const tx = ((x % n) + n) % n
  return bathyMaxZoom(idx, y2lat(y + 0.5, z), x2lon(tx + 0.5, z))
}

// ───────────────────────────────────────────────────────────── par emprise

// Ramène une emprise à un intervalle de longitude lisible. Rend `null` si
// l'emprise n'est pas exploitable.
//
// ══════════ ⚠️ LE SIGNE, ET PLUS L'HEURISTIQUE DES 180° ═════════════════════
//
// CE QUI ÉTAIT ÉCRIT ICI : « une étendue de PLUS de 180° n'est jamais un vrai
// bloc (le plus large fait quelques dizaines de km) : c'est la signature d'un
// enroulement ». C'était exact tant que le plus large des blocs faisait quelques
// dizaines de kilomètres. Ça ne l'est plus.
//
// MESURÉ le 2026-08-02 : une emprise 3×3 fait NEUF tuiles de large, soit 202,5°
// à z4 et 405° à z3. Sur l'Europe en 3×3 z4, l'heuristique prenait donc le
// COMPLÉMENT — une bande de 157,5° à l'autre bout du globe — et il en sortait
// deux dégâts. Le premier est visible : la bathymétrie fine était refusée,
// `maxZoomForBounds` retombant au socle GEBCO. Le second ne l'est pas, et il est
// plus grave : le CRÉDIT EMODNET DISPARAISSAIT DE L'ÉCRAN, alors que le
// paragraphe « OBLIGATION DE LICENCE » quarante lignes plus bas dit exactement
// ce que ça engage.
//
// LA RÈGLE MAINTENANT : le SIGNE. `minLon > maxLon` veut dire « l'emprise
// franchit ±180° » — la convention que `tilesForBBox` respecte depuis toujours,
// et que `spanLon` porte pour tout le monde. Plus personne ne devine.
//
// ⚠️ CE QUI REND LE CHANGEMENT SÛR : plus aucun producteur d'emprise ne trie ses
// longitudes. `demBounds` a été corrigé, `patchBounds` l'a été le même jour pour
// le même défaut. Une emprise triée n'arrive donc plus jusqu'ici.
function lonSpan(bounds) {
  if (!bounds) return null
  const { minLat, maxLat, minLon, maxLon } = bounds
  if (![minLat, maxLat, minLon, maxLon].every(Number.isFinite)) return null
  // Un tour du monde ou plus : tout est dedans, il n'y a plus d'intervalle à
  // découper. Le plancher z3 en 3×3 tombe précisément dans ce cas (405°).
  if (spanLon(minLon, maxLon) >= 360) return { west: -180, east: 180 }
  return { west: minLon, east: maxLon }
}

const overlaps = (z, s, bounds) =>
  Math.max(bounds.minLat, bounds.maxLat) >= z.south &&
  Math.min(bounds.minLat, bounds.maxLat) <= z.north &&
  spanOverlap(s.west, s.east, z.west, z.east)

// Deux intervalles de longitude se croisent-ils, l'un ou l'autre pouvant
// enjamber ±180 ? On teste l'appartenance des quatre bornes dans les deux sens :
// c'est suffisant, et ça évite de découper les intervalles en morceaux.
function spanOverlap(w1, e1, w2, e2) {
  return (
    spanContainsLon(w1, w2, e2) ||
    spanContainsLon(e1, w2, e2) ||
    spanContainsLon(w2, w1, e1) ||
    spanContainsLon(e2, w1, e1)
  )
}

// Le plafond pour tout un damier. Optimiste (le MAX) : un plafond trop haut ne
// coûte qu'un 404 que `bathyMisses` mémorise une fois pour toutes, alors qu'un
// plafond trop bas rendrait invisible une donnée déjà déployée.
export function maxZoomForBounds(index, bounds) {
  const idx = asIndex(index)
  const s = lonSpan(bounds)
  if (!s) return idx.base.zmax
  for (const z of idx.zones) if (overlaps(z, s, bounds)) return z.zmax // triées, la première est la plus fine
  return idx.base.zmax
}

// ─────────────────────────────────────────────────────────────── crédits
//
// ⚠️ OBLIGATION DE LICENCE, pas une politesse. Toute image exportée et tout
// écran de crédits doivent porter ces phrases telles quelles dès que la source
// correspondante a servi à dessiner le fond marin visible.
//
// Le socle est cité en toutes circonstances : GEBCO est toujours sous la carte,
// y compris sous une surcouche fine (c'est lui qui rebouche les trous).
export function creditsForBounds(index, bounds) {
  const idx = asIndex(index)
  const s = lonSpan(bounds)
  const ids = new Set([idx.base.source])
  if (s) for (const z of idx.zones) if (overlaps(z, s, bounds)) ids.add(z.source)
  const out = []
  for (const id of ids) {
    const src = SOURCES[id]
    // Une source hors catalogue n'invente pas de crédit : on nomme l'identifiant
    // brut, ce qui rend le trou VISIBLE au lieu de le taire.
    out.push(src ? src.credit : `Source bathymétrique « ${id} » — attribution à compléter`)
  }
  out.push(NO_NAVIGATION)
  return out
}
