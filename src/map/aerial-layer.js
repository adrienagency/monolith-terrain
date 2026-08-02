// Aerial photo skin for the terrain — France and Switzerland.
//
// Nothing is stored. Tiles are fetched per view straight from each country's
// public WMTS — measured 1.1-3.4 MB for a view, 0 bytes deployed. The 887 MB
// road-tile lesson (ce calque-là a fini par quitter le site) was about data we
// HOST; this hosts nothing.
//
// Off by default: photography is a mode, not the identity. The product's own
// register is the quiet editorial relief (hypsometric palettes, fine contours,
// marble and sand), and the photo skin is there when a course needs to be read
// against real ground.
//
// Widening further = one more entry in PROVIDERS plus its VERIFIED licence and
// a coverage test that does not rely on the server 404ing (see the note there).
// Plan: docs/superpowers/plans/2026-07-17-aerial-imagery.md.

import * as THREE from 'three'
import { tilesForBBox, spanLon, centreLon, grilleTuiles } from './tile-index.js'
import { worldToLatLon, demSpan } from '../geo.js'

// The loaded FIELD's exact lon/lat footprint, from its own two corners.
//
// This is NOT patchBounds(): that one pads by 5% + 0.01deg on purpose, to widen
// the net when SEARCHING for features near the patch. Using it to describe the
// block itself measured 12% oversize and a ~5 km north-west shift of the
// imagery — a lake climbing a hillside. A photo has to be registered to the
// ground it's painted on, so it gets the true extent, nothing padded.
//
// ══════════ POURQUOI `demSpan` ET PAS `TERRAIN_SIZE` — LA PHOTO SUR 1/9 ══════
//
// Adrien, en mode continu : « la map aérienne qu'on active ne se charge que sur
// 1 carreau sur 9 ». La cause tenait dans la ligne ci-dessous, qui posait
// `HALF = TERRAIN_SIZE / 2` (28 unités) alors que `worldToLatLon` divise par
// `demSpan(dem)` — 168 sur une emprise 3×3. La bbox décrivait donc le TIERS
// central de la largeur, donc un NEUVIÈME de la surface visible. C'est
// exactement l'erreur qui s'est déjà glissée trois fois sur cette branche : une
// longueur qui oublie que l'emprise triple le bloc.
//
// ⚠️ ET COUVRIR LES NEUF DALLES COÛTE MOINS CHER QU'AUJOURD'HUI, PAS NEUF FOIS
// PLUS. MESURÉ, budget de texture 4096, sur les trois zones de référence (mont
// St Helens z13, Chamonix z12, La Réunion z13 — toutes trois donnent le même
// tableau, à la tuile près) :
//
//   | ce qu'on demande            | imagerie | tuiles | canevas | mémoire  |
//   | un bloc, aujourd'hui        |   z15    |   144  | 3072²   |  36,0 Mo |
//   | neuf blocs au même cran     |   z15    |  1296  | 9×3072² | 324,0 Mo |
//   | L'EMPRISE, au MÊME budget   |   z13    |    81  | 2304²   |  20,3 Mo |
//
// La raison est que `aerialZoomFor` borne le CANEVAS, pas le nombre de tuiles :
// une bbox trois fois plus large au même budget descend simplement de deux
// crans d'imagerie, et une tuile d'un cran plus grossier couvre quatre fois la
// surface. Le « chargement grossier qui couvre les neuf dalles tout de suite »
// qu'Adrien a tranché ne se paie donc pas — il s'obtient en cessant de mentir
// sur l'emprise. 0,56× les tuiles d'UN bloc, et 15,7 Mo de MOINS que ce qui
// tourne aujourd'hui. Le badge « bêta » n'a pas à monter : ce poste DESCEND.
//
// ⚠️ LE CHIFFRE « 1 296 tuiles / 135 s / 604 Mo » DU DOSSIER EST À CORRIGER. Il
// était présenté comme mesuré ; il était DÉRIVÉ (9 × le coût d'un bloc), et son
// poste mémoire était faux même en tant que dérivé : 1 296 tuiles de 256² en
// RGBA font 324 Mo, pas 604. Rien de tout cela n'a jamais été chronométré.
//
// ⚠️ CE QUE CE CHANGEMENT NE FAIT PAS : l'AFFINAGE. Le cran suivant sur
// l'emprise (z14 ici) demande 324 tuiles et un canevas 4608² — au-dessus du
// budget 4096, et très au-dessus des 2048 que WebGL2 garantit. Une seule
// texture ne peut donc pas porter l'emprise en fin. L'affinage par priorité
// depuis le centre demande une SECONDE texture couvrant la dalle regardée, en
// surimpression du grossier : c'est le jalon suivant, mesuré à +36 Mo (le coût
// exact de ce qui tourne aujourd'hui).
//
// Hors mode continu, `demSpan` rend 56 au bit près : le mode ordinaire est
// rigoureusement inchangé, et le test le verrouille.
// ⚠️ PAS DE Math.min/Math.max SUR LA LONGITUDE — ET C'EST TOUT LE SUJET.
//
// LE DÉFAUT, tel qu'Adrien l'a vu : aux zooms lointains, la mer débordait sur
// les terres, les rivières traversaient la carte en lignes droites, les noms
// étaient décalés et la photo s'arrêtait avant le bord du socle en étirant ses
// texels. QUATRE symptômes, UN seul défaut, ici.
//
// `worldToLatLon` ENROULE volontairement l'indice de tuile dans [0, n) — son
// commentaire le dit, un bloc peut chevaucher ±180°. Les deux coins sont donc
// enroulés SÉPARÉMENT : sur un bloc à cheval, le coin ouest ressort à +150° et
// le coin est à −140°. Prendre le min et le max des deux rend alors
// [−140, +150], soit 290° — LE COMPLÉMENT de l'emprise réelle, qui en fait 70.
//
// MESURÉ le 2026-08-02, bloc centré sur le Pacifique : la fonction rendait
// minLon −180 / maxLon 112,5, soit 292,5° de large pour 55,8° de haut. Or le
// bloc est CARRÉ en Mercator : sa hauteur vaut 0,188 du monde, donc sa largeur
// aussi, soit 67,5°. Et 360 − 292,5 = 67,5. L'arithmétique referme le dossier.
//
// Tout ce qui descend de cette emprise partait donc faux : le masque de mer et
// la plage d'altitude étaient calculés sur la moitié du Pacifique (d'où la mer
// qui monte), les tuiles couvraient le mauvais tour du globe, et chaque objet
// placé par lat/lon atterrissait ailleurs.
//
// LA CONVENTION EXISTAIT DÉJÀ, on la piétinait : `tilesForBBox` traite
// `minLon > maxLon` comme « l'emprise s'enroule », et découpe en deux spans.
// Il suffit donc de RENDRE LES BORDS TELS QU'ILS SONT — ouest puis est — au
// lieu de les trier. Hors chevauchement, ouest < est et le résultat est
// identique au bit près à l'ancien.
//
// ⚠️ La LATITUDE, elle, garde son min/max : elle ne s'enroule pas, et le nord
// du bloc peut sortir de `worldToLatLon` avant ou après le sud selon
// l'orientation de la grille.
export function demBounds(dem) {
  const HALF = demSpan(dem) / 2
  const nw = worldToLatLon(dem, -HALF, -HALF) // coin ouest
  const se = worldToLatLon(dem, HALF, HALF) // coin est
  return {
    minLon: nw.lon, maxLon: se.lon,
    minLat: Math.min(nw.lat, se.lat), maxLat: Math.max(nw.lat, se.lat),
  }
}

const TILE_PX = 256
// What we'd LIKE the composited texture to be. At the finest terrain scale
// (z15, a ~2.5 km block) 4096 buys 0.83 m/texel — measured, and sharp enough
// that the photo holds up against the relief instead of smearing.
//
// It is a wish, not a guarantee: the real ceiling is whatever the device
// reports (WebGL2 only GUARANTEES 2048; a desktop GPU offers 16384). Pass the
// device's own limit in — see AerialLayer's constructor.
//
// Cost is quadratic in both directions, and it is not small: 4096 at z15 is
// 144 tile fetches and ~15 s on a fast connection, against ~36 fetches and ~4 s
// at 2048. Re-measure both before moving this.
const TARGET_TEXTURE_PX = 4096

// PROVIDERS ------------------------------------------------------------------
// Attribution is a LEGAL obligation under most licences below, not a courtesy.
// It must be visible whenever the imagery is, and gone when it isn't.
//
// Every entry was LIVE-VERIFIED (2026-07, 178 curl probes across two research
// agents): licence page quoted, EPSG:3857 slippy grid confirmed (any national
// grid or WMS was rejected — that is the mis-registration hazard), CORS header
// present (a tainted canvas cannot become a WebGL texture), max zoom probed,
// and out-of-coverage behaviour recorded. The last one matters most: services
// that answer 200-with-placeholder OUTSIDE their country (swisstopo, PDOK,
// PNOA, Bavaria, NRW, Luxembourg, Taiwan...) can never be reached by
// elimination — only a positive polygon/box test may route to them, or foreign
// blocks silently render their blank tiles.
//
// BANNED (verified bad licences): EOX s2cloudless (commercial needs a paid
// licence), Esri World Imagery (no rights outside ArcGIS use cases).
// CONDITIONAL, not shipped: Finland MML + Denmark (free but per-user API key),
// New Zealand LINZ (CC BY 4.0 but key by email), Australia NSW (licence
// ambiguity — third-party imagery in the mosaic, needs written confirmation).
//
// Coarse outlines on purpose: at block scale (2-80 km) a few km of border slop
// is invisible, and centre-point routing decides anyway. FR/CH set the
// precedent. Order in PROVIDERS = priority; the GLOBAL NASA fallback is last
// and covers everything, including the sea ("couverture maritime").

export const IGN_ATTRIBUTION = 'Orthophotos © IGN'
export const SWISSTOPO_ATTRIBUTION = '© swisstopo'

// Standard ray casting. Exported for tests.
export function pointInPolygon(lon, lat, ring) {
  let inside = false
  for (let i = 0, j = ring.length - 1; i < ring.length; j = i++) {
    const [xi, yi] = ring[i]
    const [xj, yj] = ring[j]
    if ((yi > lat) !== (yj > lat) && lon < ((xj - xi) * (lat - yi)) / (yj - yi) + xi) inside = !inside
  }
  return inside
}

const inBox = (lon, lat, b) => lon >= b[0] && lon <= b[2] && lat >= b[1] && lat <= b[3]
const inAnyBox = (lon, lat, boxes) => boxes.some((b) => inBox(lon, lat, b))

// Switzerland: tested FIRST of the alpine cluster — swisstopo answers 200
// outside its borders (verified at Annecy), so only a positive test may
// route to it. France's outline deliberately bulges OVER Switzerland (it
// can: Switzerland matches first) instead of tracing that concave border —
// tracing it coarsely is what once put Chamonix on the wrong side.
const CH_OUTLINE = [
  [7.59, 47.59], [8.62, 47.76], [9.65, 47.55], [9.60, 47.06], [10.49, 46.87],
  [10.45, 46.53], [10.15, 46.23], [9.05, 45.82], [8.80, 46.10], [8.44, 46.46],
  [7.85, 45.92], [7.05, 45.87], [6.80, 46.05], [6.13, 46.14], [5.96, 46.13],
  [6.06, 46.42], [6.44, 46.77], [6.87, 47.00], [7.00, 47.50],
]
// v48 : le bord ouest suivait une diagonale grossière qui coupait à travers la
// BRETAGNE SUD — Lorient, Quiberon, Concarneau, Quimper tombaient hors IGN
// (retour Adrien : « pas de carte dans le golfe du Morbihan »). Le bord épouse
// désormais la côte atlantique et le pourtour du Finistère.
const FR_OUTLINE = [
  // north tip pushed to Bray-Dunes / Dunkirk (~51.09) — the old 51.03 edge cut
  // Dunkirk out, so it fell back to the global provider and the aerial failed
  [2.62, 51.10], [4.23, 50.28], [6.36, 49.46], [8.23, 48.97], [7.59, 47.59],
  [8.40, 47.00], [9.60, 46.30], [7.90, 45.85], [7.19, 44.12], [7.53, 43.78],
  [5.00, 43.00], [3.04, 42.47], [0.66, 42.69], [-1.79, 43.35], [-1.25, 44.50],
  [-1.15, 46.20], [-2.25, 47.05], [-2.60, 47.25], [-3.30, 47.28], [-3.90, 47.55],
  [-4.40, 47.72], [-4.90, 47.95], [-4.95, 48.45], [-1.85, 49.72], [1.58, 50.95],
]
const FR_BOXES = [
  [8.5, 41.3, 9.6, 43.1], // Corsica
  [-61.9, 14.3, -60.7, 16.6], // Guadeloupe + Martinique
  [-54.7, 2.0, -51.5, 6.0], // Guyane
  [55.1, -21.5, 55.9, -20.8], // La Reunion
  [45.0, -13.1, 45.4, -12.6], // Mayotte
]
// Austria: alpine neighbour of four other providers — polygon, not a box (a
// box would swallow Bavaria's border towns and South Tyrol).
const AT_OUTLINE = [
  [9.53, 47.27], [9.60, 47.06], [10.45, 46.90], [12.15, 46.65], [13.70, 46.40],
  [14.60, 46.40], [16.10, 46.65], [17.10, 47.90], [16.95, 48.60], [15.05, 49.02],
  [13.80, 48.77], [12.75, 48.12], [10.45, 47.55], [9.53, 47.27],
]
// Bavaria: after Austria in order, so the shared Alps border routes alpine
// centres to Austria and Bavarian ones here.
const BAYERN_BOX = [9.85, 47.25, 13.9, 50.6] // west edge east of Stuttgart — Lindau's corner is the accepted slop
const NRW_BOX = [5.85, 50.3, 9.5, 52.55]
// Netherlands after Flanders/Luxembourg (all three overlap in a coarse world)
const NL_OUTLINE = [
  [3.35, 51.35], [4.25, 51.35], [5.85, 50.75], [6.25, 51.85], [7.25, 52.25],
  [7.25, 53.35], [6.35, 53.55], [4.55, 53.25], [3.35, 51.55],
]
const VL_BOX = [2.52, 50.68, 5.95, 51.51] // Flanders (northern Belgium)
const LU_BOX = [5.7, 49.44, 6.55, 50.2]
const ES_OUTLINE = [
  [-9.35, 43.15], [-7.95, 43.85], [-4.50, 43.55], [-1.75, 43.45], [-1.40, 43.25],
  [0.70, 42.85], [3.25, 42.40], [2.40, 41.15], [0.45, 39.85], [0.10, 38.75], [-0.60, 37.80],
  [-2.10, 36.70], [-5.40, 36.00], [-7.40, 37.15], [-6.85, 41.05], [-8.85, 41.85],
]
const ES_BOXES = [
  [1.15, 38.6, 4.4, 40.15], // Balearics
  [-18.2, 27.6, -13.3, 29.5], // Canaries
]
const CZ_OUTLINE = [
  [12.05, 50.25], [13.85, 50.75], [15.05, 51.05], [16.95, 50.45], [18.85, 49.95],
  [18.55, 49.50], [17.15, 48.85], [16.90, 48.60], [15.05, 48.98], [13.80, 48.77],
  [12.65, 49.45],
]
const SK_BOX = [16.85, 47.72, 22.6, 49.28] // top pinned UNDER Zakopane (49.30) — the Tatra crest is the border
// Poland: the southern edge dips around the Tatras so Zakopane stays Polish
// and Poprad Slovak — prime trail country on both sides of that border.
const PL_OUTLINE = [
  [14.15, 52.85], [14.15, 50.85], [16.95, 50.45], [18.85, 49.95], [19.40, 49.42],
  [20.10, 49.20], [21.00, 49.22], [22.90, 49.05], [23.60, 50.40], [23.95, 52.75],
  [23.50, 54.35], [19.60, 54.48], [16.90, 54.60], [14.20, 53.90],
]
const EE_BOX = [21.7, 57.5, 28.2, 59.75]
// USA: CONUS polygon (a box would swallow Toronto and half the Canadian
// border cities — USGS then 404s and the layer would die with a network
// message, the wrong story), plus Alaska + Hawaii boxes.
const US_OUTLINE = [
  [-124.8, 48.4], [-123.2, 49.05], [-95.15, 49.05], [-88.35, 48.30], [-84.85, 46.90],
  [-82.40, 45.35], [-82.55, 42.95], [-78.95, 42.85], [-76.80, 43.65], [-74.70, 45.05],
  [-71.50, 45.05], [-67.80, 47.10], [-66.90, 44.60], [-70.00, 41.50], [-75.50, 35.20],
  [-80.50, 25.10], [-83.00, 29.00], [-97.15, 25.85], [-106.50, 31.75], [-114.80, 32.50],
  [-124.40, 32.50],
]
const US_BOXES = [
  [-168.2, 54.5, -130.0, 71.5], // Alaska
  [-160.6, 18.8, -154.7, 22.3], // Hawaii
]
// Japan: an arc, not a box — a box swallows Vladivostok and Busan. Two
// polygons hug the archipelago's concave Sea-of-Japan side.
const JP_OUTLINE = [
  [129.35, 32.60], [130.90, 33.90], [132.40, 35.40], [135.90, 35.75], [137.20, 37.60],
  [139.40, 38.60], [139.90, 40.60], [140.00, 42.00], [139.60, 43.40], [141.50, 45.65],
  [145.60, 44.40], [146.10, 43.20], [143.50, 41.60], [141.80, 40.60], [141.20, 38.30],
  [141.00, 35.60], [140.40, 34.60], [136.80, 33.90], [134.50, 33.00], [132.20, 32.40],
  [130.90, 30.90], [129.60, 31.20],
]
const JP_BOXES = [[122.8, 24.0, 129.5, 27.6]] // Okinawa arc
const TW_BOX = [119.9, 21.8, 122.1, 25.4]

// ArcGIS caches address tiles as z/y/x; WMTS KVP carries them as named
// params; some services put row before col in REST paths. Each url() hides
// its service's quirk so callers only ever think in slippy z/x/y.
export const PROVIDERS = [
  {
    id: 'swisstopo', attribution: '© swisstopo', maxZoom: 19,
    covers: (lon, lat) => pointInPolygon(lon, lat, CH_OUTLINE),
    url: (z, x, y) => `https://wmts.geo.admin.ch/1.0.0/ch.swisstopo.swissimage/default/current/3857/${z}/${x}/${y}.jpeg`,
  },
  {
    id: 'ign', attribution: 'Orthophotos © IGN', maxZoom: 19,
    covers: (lon, lat) => pointInPolygon(lon, lat, FR_OUTLINE) || inAnyBox(lon, lat, FR_BOXES),
    url: (z, x, y) =>
      'https://data.geopf.fr/wmts?SERVICE=WMTS&REQUEST=GetTile&VERSION=1.0.0' +
      '&LAYER=ORTHOIMAGERY.ORTHOPHOTOS&STYLE=normal&FORMAT=image/jpeg' +
      `&TILEMATRIXSET=PM&TILEMATRIX=${z}&TILEROW=${y}&TILECOL=${x}`,
  },
  {
    id: 'basemap-at', attribution: 'Datenquelle: basemap.at', maxZoom: 19,
    covers: (lon, lat) => pointInPolygon(lon, lat, AT_OUTLINE),
    url: (z, x, y) => `https://mapsneu.wien.gv.at/basemap/bmaporthofoto30cm/normal/google3857/${z}/${y}/${x}.jpeg`,
  },
  {
    id: 'lu-act', attribution: '© ACT Luxembourg', maxZoom: 18,
    covers: (lon, lat) => inBox(lon, lat, LU_BOX),
    url: (z, x, y) =>
      'https://wmts.geoportail.lu/opendata/service?SERVICE=WMTS&REQUEST=GetTile&VERSION=1.0.0' +
      '&LAYER=ortho_latest&STYLE=default&FORMAT=image/jpeg' +
      `&TILEMATRIXSET=GLOBAL_WEBMERCATOR_4_V3&TILEMATRIX=${z}&TILEROW=${y}&TILECOL=${x}`,
  },
  {
    id: 'vlaanderen', attribution: '© Informatie Vlaanderen', maxZoom: 18,
    covers: (lon, lat) => inBox(lon, lat, VL_BOX),
    url: (z, x, y) =>
      'https://geo.api.vlaanderen.be/OMWRGBMRVL/wmts?SERVICE=WMTS&REQUEST=GetTile&VERSION=1.0.0' +
      '&LAYER=omwrgbmrvl&STYLE=&FORMAT=image/png' +
      `&TILEMATRIXSET=GoogleMapsVL&TILEMATRIX=${z}&TILEROW=${y}&TILECOL=${x}`,
  },
  {
    id: 'pdok', attribution: 'Luchtfoto: PDOK / Beeldmateriaal.nl', maxZoom: 20,
    covers: (lon, lat) => pointInPolygon(lon, lat, NL_OUTLINE),
    url: (z, x, y) => `https://service.pdok.nl/hwh/luchtfotorgb/wmts/v1_0/Actueel_ortho25/EPSG:3857/${z}/${x}/${y}.jpeg`,
  },
  {
    id: 'nrw', attribution: 'Geobasis NRW (dl-zero-de/2.0)', maxZoom: 19,
    covers: (lon, lat) => inBox(lon, lat, NRW_BOX),
    // NRW's matrix ids are offset: matrix "00" is world zoom 5, so z maps to
    // a two-digit id of z-5. Verified live (Cologne z14 = matrix 09).
    url: (z, x, y) => `https://www.wmts.nrw.de/geobasis/wmts_nw_dop/tiles/nw_dop/EPSG_3857_16/${String(z - 5).padStart(2, '0')}/${x}/${y}`,
  },
  {
    id: 'bayern', attribution: '© Bayerische Vermessungsverwaltung', maxZoom: 18,
    covers: (lon, lat) => inBox(lon, lat, BAYERN_BOX),
    url: (z, x, y) => `https://wmtsod1.bayernwolke.de/wmts/by_dop/smerc/${z}/${x}/${y}`,
  },
  {
    id: 'pnoa', attribution: 'PNOA © IGN España CC BY 4.0 scne.es', maxZoom: 20,
    covers: (lon, lat) => pointInPolygon(lon, lat, ES_OUTLINE) || inAnyBox(lon, lat, ES_BOXES),
    url: (z, x, y) =>
      'https://www.ign.es/wmts/pnoa-ma?request=GetTile&service=WMTS&VERSION=1.0.0' +
      '&Layer=OI.OrthoimageCoverage&Style=default&Format=image/jpeg' +
      `&TileMatrixSet=GoogleMapsCompatible&TileMatrix=${z}&TileRow=${y}&TileCol=${x}`,
  },
  {
    id: 'cuzk', attribution: '© ČÚZK', maxZoom: 19,
    covers: (lon, lat) => pointInPolygon(lon, lat, CZ_OUTLINE),
    url: (z, x, y) => `https://ags.cuzk.gov.cz/arcgis1/rest/services/ORTOFOTO_WM/MapServer/tile/${z}/${y}/${x}`,
  },
  {
    id: 'zbgis', attribution: '© GKÚ, NLC Slovensko', maxZoom: 18,
    covers: (lon, lat) => inBox(lon, lat, SK_BOX),
    url: (z, x, y) => `https://zbgis.skgeodesy.sk/zbgis/rest/services/Ortofoto/MapServer/tile/${z}/${y}/${x}`,
  },
  {
    id: 'gugik', attribution: 'GUGiK Ortofotomapa', maxZoom: 18,
    covers: (lon, lat) => pointInPolygon(lon, lat, PL_OUTLINE),
    url: (z, x, y) =>
      'https://mapy.geoportal.gov.pl/wss/service/PZGIK/ORTO/WMTS/StandardResolution?SERVICE=WMTS&REQUEST=GetTile&VERSION=1.0.0' +
      '&LAYER=ORTOFOTOMAPA&STYLE=default&FORMAT=image/jpeg' +
      `&TILEMATRIXSET=EPSG:3857&TILEMATRIX=EPSG:3857:${z}&TILEROW=${y}&TILECOL=${x}`,
  },
  {
    id: 'maaamet', attribution: 'Aluskaart: Maa-amet', maxZoom: 18,
    covers: (lon, lat) => inBox(lon, lat, EE_BOX),
    url: (z, x, y) => `https://tiles.maaamet.ee/tm/wmts/1.0.0/foto/default/GMC/${z}/${y}/${x}.jpg`,
  },
  {
    id: 'usgs', attribution: 'USDA, USGS The National Map: Orthoimagery', maxZoom: 16,
    covers: (lon, lat) => pointInPolygon(lon, lat, US_OUTLINE) || inAnyBox(lon, lat, US_BOXES),
    url: (z, x, y) => `https://basemap.nationalmap.gov/arcgis/rest/services/USGSImageryOnly/MapServer/tile/${z}/${y}/${x}`,
  },
  {
    id: 'gsi', attribution: '出典：国土地理院 (GSI Japan)', maxZoom: 18,
    covers: (lon, lat) => pointInPolygon(lon, lat, JP_OUTLINE) || inAnyBox(lon, lat, JP_BOXES),
    url: (z, x, y) => `https://cyberjapandata.gsi.go.jp/xyz/seamlessphoto/${z}/${x}/${y}.jpg`,
  },
  {
    id: 'nlsc', attribution: '© NLSC Taiwan', maxZoom: 20,
    covers: (lon, lat) => inBox(lon, lat, TW_BOX),
    url: (z, x, y) => `https://wmts.nlsc.gov.tw/wmts/PHOTO2/default/GoogleMapsCompatible/${z}/${y}/${x}`,
  },
  {
    // The GLOBAL floor — NASA Blue Marble, CC0, land + OCEAN, cloud-free.
    // This is the maritime coverage ("couverture maritime") AND the fallback
    // for every country without a national provider. z8 cap = ~600 m/px:
    // honest at sea and at far zooms, deliberately never mistaken for a
    // national orthophoto up close.
    id: 'nasa', attribution: 'NASA GIBS Blue Marble', maxZoom: 8, global: true,
    covers: () => true,
    url: (z, x, y) => `https://gibs.earthdata.nasa.gov/wmts/epsg3857/best/BlueMarble_NextGeneration/default/GoogleMapsCompatible_Level8/${z}/${y}/${x}.jpeg`,
  },
]

// Which provider serves this patch, or null. Judged on the patch CENTRE — a
// block half-overlapping a border shouldn't flip provider because one corner
// clips it; the user is looking at whatever sits in the middle.
export function providerFor(bbox) {
  if (!bbox) return null
  // `centreLon` et pas une moyenne : sur une emprise qui franchit ±180°, la
  // moyenne tombe à l'exact opposé du globe — et on choisirait le fournisseur
  // des antipodes sans qu'aucune erreur ne le signale.
  const lon = centreLon(bbox.minLon, bbox.maxLon)
  const lat = (bbox.minLat + bbox.maxLat) / 2
  return PROVIDERS.find((p) => p.covers(lon, lat)) ?? null
}

// Exported for tests: is this patch inside covered territory?
export function aerialCovers(bbox) {
  return !!providerFor(bbox)
}

// Why the view can't have imagery — with the NASA global floor in the
// registry this can only be "nothing loaded yet" (null bbox). Kept as the
// single honest gate: if the floor is ever removed, the centred-notice path
// in main.js starts speaking again without being rewired.
export function aerialUnavailable(bbox) {
  if (!bbox) return null
  if (!aerialCovers(bbox)) return 'No aerial photography here yet.'
  return null
}

// Widest side of the tile mosaic, in pixels, at a given zoom. This is what
// actually becomes the canvas, so it — not the tile COUNT — is what has to fit
// the texture budget.
//
// ⚠️ `grilleTuiles` ET PAS `max(xs) − min(xs)`. Sur une emprise à cheval sur
// ±180°, la soustraction rendait 256 colonnes pour 16 tuiles : le budget était
// alors mesuré contre un canevas imaginaire, et le zoom choisi n'avait plus
// aucun rapport avec ce qui allait vraiment être alloué.
function mosaicPx(bbox, z) {
  const g = grilleTuiles(tilesForBBox(bbox, z), z)
  if (!g) return 0
  return Math.max(g.cols, g.rows) * TILE_PX
}

// Le zoom d'imagerie LE PLUS FIN dont la mosaïque tient encore dans le budget,
// ou `null` si AUCUN ne tient.
//
// ══════════ POURQUOI `null`, ET PAS « z6 QUOI QU'IL ARRIVE » ════════════════
//
// La version d'avant partait de `best = 6` et rendait donc 6 même quand z6
// crevait le budget. Son propre commentaire disait « a cap you step over is not
// a cap » — et c'était redevenu vrai, en silence, le jour où le plancher de
// l'escalier de zoom est descendu à z3.
//
// MESURÉ, budget 4 096 px, sur une emprise 3×3 (neuf tuiles de large) :
//   · z3 → 405° de large → canevas 16 384 × 15 104 = 990 Mo, 531 requêtes ;
//   · z4 → 202,5°        → canevas  9 472 ×  9 472 = 359 Mo, 1 369 requêtes.
// Et `build()` allouait tout cela sans jamais comparer au budget ni à
// `maxTexturePx`. WebGL2 ne garantit que 2 048 px : au-delà, une texture ne
// ralentit pas, elle ÉCHOUE.
//
// Rendre `null` est ce qui donne à l'appelant le droit de RENONCER. Une couche
// absente est un état honnête ; un onglet qui fige le navigateur ne l'est pas.
export function aerialZoomFor(bbox, { maxZoom = 19, budgetPx = TARGET_TEXTURE_PX } = {}) {
  let best = null
  for (let z = 6; z <= maxZoom; z++) {
    const px = mosaicPx(bbox, z)
    if (px === 0) continue // aucune tuile à ce zoom : rien à conclure, on monte
    if (px > budgetPx) break // tous les zooms plus fins sont plus gros encore
    best = z
  }
  return best
}

// ══════════ LA GRILLE D'UNE MOSAÏQUE, ET LE REFUS QUAND ELLE NE TIENT PAS ═══
//
// Les quatre couches drapées partagent ce guichet, et c'est délibéré : elles
// partageaient déjà la même arithmétique de grille COPIÉE QUATRE FOIS, et c'est
// précisément ce qui a laissé passer le miroir de l'antiméridien dans les
// quatre à la fois.
//
// ⚠️ LE REFUS EST LA MOITIÉ DU TRAVAIL. `aerialZoomFor` borne déjà le zoom, mais
// un `zmax` de zone (occupation du sol, canopée) ou un plafond de fournisseur
// peut FORCER un zoom que la borne n'a pas choisi. Sans ce second garde, `build`
// allouait un canevas sans jamais le comparer à quoi que ce soit : 990 Mo
// mesurés au plancher z3. Une texture au-dessus de la limite du GPU ne ralentit
// pas, elle ÉCHOUE — et WebGL2 ne garantit que 2 048 px.
//
// Rendre `null` fait renoncer l'appelant, ce qui est un état honnête : la couche
// ne s'affiche pas, et elle le dit.
//
// @param {{x:number,y:number}[]} tuiles
// @param {number} z
// @param {number} budgetPx - le plus petit du budget voulu et de `maxTexturePx`
// @param {string} nom - pour que la console dise QUELLE couche a renoncé
export function grilleMosaique(tuiles, z, budgetPx, nom = 'mosaïque') {
  const g = grilleTuiles(tuiles, z)
  if (!g) return null
  const px = Math.max(g.cols, g.rows) * TILE_PX
  if (px > budgetPx) {
    // On le DIT. Une couche qui renonce en silence se lit comme une couche
    // cassée, et c'est le développeur suivant qui paie la recherche.
    console.warn(`${nom} : canevas ${g.cols * TILE_PX}×${g.rows * TILE_PX} px au-dessus du budget ${budgetPx} — couche non construite.`)
    return null
  }
  return g
}

// Returned by build() when a newer build has taken over. Distinct from null
// (genuine failure) and from a built layer: the caller must leave everything
// exactly as it is, because someone else is already producing the real answer.
export const SUPERSEDED = Object.freeze({ superseded: true })

export class AerialLayer {
  // `maxTexturePx` is the DEVICE's limit (THREE.WebGLRenderer exposes it as
  // renderer.capabilities.maxTextureSize). We never ask for more than it or
  // more than we want: a texture over the limit is not slow, it FAILS, and on
  // a phone that limit can be 4x lower than on the desktop this was built on.
  constructor({ maxTexturePx = TARGET_TEXTURE_PX } = {}) {
    this._budgetPx = Math.min(TARGET_TEXTURE_PX, maxTexturePx)
    this._texture = null
    this._buildId = 0
  }

  // `bbox` is the TRUE extent of the loaded field — see demBounds(). Do NOT pass
  // patchBounds(): it pads by 5% + 0.01deg to widen a data SEARCH, which
  // measured 12% oversize and ~5 km of NW shift when used as the block's own
  // footprint. Returns { texture, uv, attribution, tiles, zoom } or null when
  // the patch isn't covered. Never throws: a failed layer leaves the map usable.
  async build(bbox) {
    const id = ++this._buildId
    const provider = providerFor(bbox)
    if (!provider) return null

    const z = aerialZoomFor(bbox, { budgetPx: this._budgetPx, maxZoom: provider.maxZoom })
    // `null` = aucun zoom ne tient dans le budget. On RENONCE, au lieu de bâtir
    // le canevas de 990 Mo que le plancher z3 demandait.
    if (z === null) return null
    const tiles = tilesForBBox(bbox, z)
    if (!tiles.length) return null

    const grille = grilleMosaique(tiles, z, this._budgetPx, 'photo aérienne')
    if (!grille) return null
    const { x0, y0, cols, rows } = grille

    const canvas = document.createElement('canvas')
    canvas.width = cols * TILE_PX
    canvas.height = rows * TILE_PX
    const ctx = canvas.getContext('2d')

    // MARITIME/EDGE UNDERLAY: when the block is served by a national
    // provider, the global NASA floor is composited UNDERNEATH it first.
    // National orthophotos stop at the shoreline (and at country edges), and
    // an unpainted canvas there rendered as black holes over the sea — the
    // exact "couverture maritime" gap. Both grids are web-mercator, so each
    // low-zoom NASA tile maps to a plain scaled rectangle on this canvas.
    const globalP = PROVIDERS[PROVIDERS.length - 1]
    let attribution = provider.attribution
    if (!provider.global) {
      const gz = Math.min(globalP.maxZoom, z)
      const gTiles = tilesForBBox(bbox, gz)
      const grid = tileGridMerc(x0, y0, cols, rows, z)
      const gw = grid.maxX - grid.minX, gh = grid.maxY - grid.minY
      await Promise.all(
        gTiles.map(async (t) => {
          try {
            const img = await loadImage(globalP.url(t.z, t.x, t.y))
            if (id !== this._buildId) return
            const n = 2 ** t.z
            const px = ((t.x / n - grid.minX) / gw) * canvas.width
            const py = ((t.y / n - grid.minY) / gh) * canvas.height
            const pw = (1 / n / gw) * canvas.width
            const ph = (1 / n / gh) * canvas.height
            ctx.drawImage(img, px, py, pw, ph)
          } catch {}
        })
      )
      if (id !== this._buildId) return SUPERSEDED
      attribution = `${provider.attribution} · NASA GIBS`
    }

    // One failed tile must not fail the patch — a hole in the mosaic beats no
    // imagery at all, and providers do 404 on edge tiles.
    let ok = 0
    await Promise.all(
      tiles.map(async (t) => {
        try {
          const img = await loadImage(provider.url(t.z, t.x, t.y))
          if (id !== this._buildId) return // a newer patch superseded us
          // `grille.colonne` et pas `t.x - x0` : sur une emprise à cheval sur
          // ±180°, la soustraction rend un indice négatif ou géant, et la tuile
          // se peint hors du canevas — invisible, sans la moindre erreur.
          ctx.drawImage(img, grille.colonne(t) * TILE_PX, grille.ligne(t) * TILE_PX)
          ok++
        } catch {}
      })
    )
    // Being superseded is NORMAL — the user moved or rezoomed while tiles were
    // in flight — and it must be reported as its own thing. It used to share
    // `null` with real failure, so a caller that reacts to failure (by warning
    // the user and switching the layer off) fired on every ordinary race.
    if (id !== this._buildId) return SUPERSEDED
    if (!ok) return null

    const uv = aerialUvTransform(bbox, tileGridMerc(x0, y0, cols, rows, z))

    this.dispose()
    const texture = new THREE.CanvasTexture(canvas)
    texture.colorSpace = THREE.SRGBColorSpace
    texture.anisotropy = 16 // grazing-angle sharpness; free on any GPU of the last decade
    texture.wrapS = texture.wrapT = THREE.ClampToEdgeWrapping
    texture.needsUpdate = true
    this._texture = texture

    return { texture, uv, attribution, tiles: tiles.length, zoom: z, provider: provider.id }
  }

  dispose() {
    this._texture?.dispose()
    this._texture = null
  }
}

// --- placing the mosaic on the block -----------------------------------------
// The composited canvas covers the TILE GRID, which always overhangs the patch
// (tiles are a fixed grid; the patch lands wherever it lands). Stretching the
// whole mosaic across the block would misregister the photo against the terrain
// by up to a tile — roads landing in fields. So the shader gets an explicit
// offset/scale instead.
//
// The maths is done in NORMALISED MERCATOR (0..1 over the whole world), not in
// lat/lon: slippy tiles are exactly mercator squares, and the DEM patch maps
// linearly to mercator too, so in that space the transform is a plain
// offset+scale. In lat/lon it would not be — mercator latitude is non-linear,
// and doing it there would skew the imagery north-south.

// lon/lat -> normalised mercator (0..1, y growing southward like tile rows)
export function lonLatToMerc(lon, lat) {
  const r = (lat * Math.PI) / 180
  return {
    x: (lon + 180) / 360,
    y: (1 - Math.log(Math.tan(r) + 1 / Math.cos(r)) / Math.PI) / 2,
  }
}

// Slippy tile grid -> its normalised-mercator bounds. Tile x/y ARE those
// coordinates scaled by 2^z, so this is just a division — no projection.
// Exporté depuis la couche « lumières nocturnes » (src/map/nuit-layer.js) : elle
// bâtit une mosaïque web-mercator par le même chemin, et dupliquer trois lignes
// d'arithmétique de grille serait la meilleure façon de les voir diverger.
export function tileGridMerc(x0, y0, cols, rows, z) {
  const n = 2 ** z
  return { minX: x0 / n, maxX: (x0 + cols) / n, minY: y0 / n, maxY: (y0 + rows) / n }
}

// UV transform mapping the block's own 0..1 surface coords onto the mosaic.
// Exported and pure so it can be unit-tested without a GPU or a network.
//
// ══════ ⚠️ L'ORIGINE DES UV EST LE COIN SUD-OUEST, PAS LE COIN NORD-OUEST ════
//
// LE DÉFAUT, tel qu'Adrien l'a vu : « la map d'éclairage nocturne est toujours
// décalée ». MESURÉ (docs/nuit-recalage/mesure-chaine.mjs rejoue la chaîne
// entière en nombres) : écart RIGOUREUSEMENT NUL en longitude, et 4 à 131 km en
// latitude selon le bloc — 84 km à Paris, 63 km à Nouméa, 24 km à Las Vegas.
// Ni constant, ni proportionnel au zoom, ni croissant avec la latitude : il
// saute d'un bloc à l'autre. Cette forme-là ne désigne qu'une seule famille de
// cause, un décalage de GRILLE.
//
// Les mosaïques drapées sont des CanvasTexture, dont `flipY` vaut true (aucune
// des deux couches ne l'éteint, contrairement à tous les autres masques du
// projet qui posent `tex.flipY = false`). En UV, v = 0 est donc la DERNIÈRE
// ligne du canevas, celle du SUD — et c'est pour ça que `uvSolDrape`
// (terrain.js) finit par `uv.y = 1.0 - uv.y`.
//
// Or le shader enchaîne dans cet ordre :
//     vec2 uv = uvSolDrape(...);   // le retournement est DEDANS
//     uv = uOffset + uv * uScale;  // puis l'affine de la couche
// et un retournement NE COMMUTE PAS avec une affine. L'offset vertical rendu
// ici doit donc se mesurer depuis le bord SUD de la grille de tuiles — depuis
// l'origine des UV — et non depuis son bord nord, comme le faisait l'ancienne
// ligne `(a.y - gridMerc.minY) / gh`. L'erreur valait exactement la DIFFÉRENCE
// des deux débords de la grille, nord moins sud.
//
// POURQUOI LA PHOTO AÉRIENNE, ELLE, PARAISSAIT JUSTE. Dès que le zoom
// d'imagerie est ≥ au zoom du DEM — le cas de tous les fournisseurs nationaux —
// les bords de la grille de tuiles coïncident avec ceux du bloc (un bord de
// tuile z13 est aussi un bord de tuile z15). Les deux débords valent zéro, leur
// différence aussi, et le défaut ne peut pas s'exprimer. Les lumières
// nocturnes, plafonnées à z8 par le capteur VIIRS, sont TOUJOURS plus
// grossières que le DEM : le bloc flotte quelque part dans une tuile de 156 km,
// et le débord vaut ce qu'il veut. Même chemin de code, un seul l'exerçait.
//
// ⚠️ ET LA PHOTO ÉTAIT FAUSSE AUSSI, là où le PLANCHER MONDIAL NASA (maxZoom 8,
// donc le même plafond) sert de fournisseur principal : en mer, et dans tout
// pays sans fournisseur national. Le calage n'avait été vérifié que sur la
// France, où ce défaut est structurellement muet.
export function aerialUvTransform(patchBBox, gridMerc) {
  const a = lonLatToMerc(patchBBox.minLon, patchBBox.maxLat) // patch top-left
  const b = lonLatToMerc(patchBBox.maxLon, patchBBox.minLat) // patch bottom-right
  // ══════════ ⚠️ LE MIROIR DE L'ANTIMÉRIDIEN, TROISIÈME ÉTAGE ═══════════════
  //
  // En mercator normalisé, x est cyclique : il retombe à 0 en franchissant
  // +180°. Sur une emprise à cheval, le bord EST est donc NUMÉRIQUEMENT plus
  // petit que le bord OUEST — mesuré aux Fidji : ouest 0,994, est 0,006. Le
  // `b.x - a.x` d'origine sortait alors à −0,99, c'est-à-dire un `scale.x`
  // NÉGATIF : la mosaïque peinte en MIROIR sur le terrain.
  //
  // On déroule d'un tour, exactement comme `spanLon` le fait en degrés et comme
  // `grilleTuiles` le fait en colonnes de tuiles. `tileGridMerc` déroule déjà de
  // son côté (son `maxX` dépasse 1 sur une grille enroulée), donc les deux
  // repères parlent enfin de la même chose.
  const bx = b.x < a.x ? b.x + 1 : b.x
  const gw = gridMerc.maxX - gridMerc.minX
  const gh = gridMerc.maxY - gridMerc.minY
  return {
    // x depuis l'ouest (les deux axes sont d'accord) ; y depuis le SUD, donc
    // depuis `gridMerc.maxY`, et sur le bord SUD du bloc (`b.y`).
    offset: [(a.x - gridMerc.minX) / gw, (gridMerc.maxY - b.y) / gh],
    scale: [(bx - a.x) / gw, (b.y - a.y) / gh],
  }
}

// crossOrigin is mandatory: IGN sends Access-Control-Allow-Origin: * (verified
// live), and without the flag the canvas is tainted and WebGL refuses it.
export function loadImage(url) {
  return new Promise((resolve, reject) => {
    const img = new Image()
    img.crossOrigin = 'anonymous'
    img.onload = () => resolve(img)
    img.onerror = reject
    img.src = url
  })
}
