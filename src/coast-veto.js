// ══════════ LE VETO DU TRAIT DE CÔTE — Tâche VETO ═══════════════════════════
//
// 🔴 CE QUE CE MODULE INTERDIT, EN UNE PHRASE :
//
//   > **Une source bathymétrique n'a pas le droit de noyer un pixel que le
//   > trait de côte VECTORIEL déclare terrestre.**
//
// POURQUOI IL A FALLU L'ÉCRIRE. PLAT a nommé le problème de fond : la fusion
// laissait une source GROSSIÈRE décider du trait de côte contre une source
// FINE. Il a posé le garde d'échelle (`CELLULE_MAX_PX`, src/bathy.js) — et il
// a mesuré, honnêtement, que ce garde **ne mord pas à z11–z13** : à 6,94 m par
// pixel de bloc, une cellule EMODnet de 111,8 m n'est « que » 16 fois plus
// grossière, c'est-à-dire exactement le régime où la bande de bruit de B5 est
// PROUVÉE NÉCESSAIRE (Porquerolles). Relevé PLAT sur la vue de Camargue :
//
//   tuile z11 px256  av=0  ap=65 536   → 100 % du champ rendu à la mer
//   tuile z12 px512  av=0  ap=262 144  → 100 %
//   tuile z13 px512  av=5 687 ap=43 713
//   tuile z15 px512  → la règle d'échelle mord, ravage 49 % → 2,7 %
//
// ⛔ ET À z12 AUCUNE RÈGLE LOCALE NE PEUT TRANCHER. La tuile est uniformément à
// +0,13 m (marais IGN) ; un remplissage de mer WebP est uniformément à +0,3 m.
// PLAT a testé QUATRE discriminants locaux — texture, dispersion, part dans la
// bande, nombre de valeurs distinctes — **aucun ne les sépare**. L'information
// qui manque n'est pas dans le champ : elle est NON LOCALE. Elle existe déjà
// dans le dépôt, sous la forme des polygones de terre OSM de
// `public/data/coast-z6`, ceux-là mêmes qui ont sauvé les polders néerlandais
// du même raisonnement topologique (voir src/sea-mask.js).
//
// ══════════ CE QUE LE VETO NE FAIT PAS — ET C'EST LA MOITIÉ DU TRAVAIL ══════
//
// ⛔ **LA MER DOIT RESTER LA MER**, et la Camargue est faite de salins et
// d'étangs RÉELLEMENT EN EAU. Un veto trop large les ferait ressortir en terre.
// Trois bornes, chacune posée exprès :
//
//   1. **Le veto ne rend pas de la terre : il refuse une reclassification.** Il
//      n'agit QUE sur la bande de bruit de B5 — la seule règle de
//      `fuseBathymetry` qui prenne une TERRE FRANCHE ET POSITIVE et la rende à
//      la mer (l'encart de `NOISE_BAND` le dit en toutes lettres). Tous les
//      autres chemins de la fusion — zéro exact, aplat de remplissage, pixel
//      déjà sous le niveau — restent ouverts AU BIT. C'est par eux que l'eau
//      réelle arrive : mesuré par PLAT, les pixels muets du terrarium à z15
//      dessinent les contours ORGANIQUES du Vaccarès
//      (`.banc/PLAT/apres/cam15-muets.png`), sans un seul angle droit. L'étang
//      passe par le zéro exact, pas par la bande de bruit.
//   2. **La côte se tait près d'elle-même.** Les polygones OSM sont
//      pré-simplifiés à 30 m (coast-z6.README.md) : rasterisés à 0,43 m la
//      cellule, ils dessineraient un rivage à facettes. On ÉRODE donc la terre
//      de `TOLERANCE_COTE_M` (src/sea-mask.js, la même constante et la même
//      raison) : à moins de 30 m du trait, aucun veto, le MNT garde la forme du
//      rivage. Chacun ce qu'il sait faire.
//   3. **Aucun masque ⇒ aucun changement.** Hors couverture, sur un échec
//      réseau, sur une emprise trop large : `null`, et la fusion se comporte
//      exactement comme avant.
//
// Module à DEUX ÉTAGES : la géométrie et l'érosion sont PURES (ni DOM, ni
// fetch, testables en node) ; seule `vetoTerre` touche au canevas et au réseau.

import { gridTileRange, loadGridFeatures, loadLandFeatures, landPolygonsInBBox, COAST_NE_MAX, GRID_ZOOM } from './coast-mask.js'
import { rayonIncertitude } from './sea-mask.js'

// Au-delà, l'emprise demandée couvre trop de tuiles z6 pour que le veto soit
// gratuit — on s'abstient plutôt que de lancer une rafale de requêtes. 16 tuiles
// z6 = un carré de ~2 400 km de côté à l'équateur : très au-delà de tout bloc.
export const TUILES_Z6_MAX = 16

// ---- géométrie (pure, testée) ----

// Mercator NORMALISÉ : u et v dans [0,1], u = 0 à −180°, v = 0 au nord. C'est
// le repère commun aux trois sites de fusion — une tuile (z,x,y) y vaut
// [x/2^z, (x+1)/2^z], un bloc DEM son emprise de tuiles, la fenêtre continue
// son emprise en degrés. Aucun des trois n'a besoin de connaître les deux
// autres.
export const uDepuisLon = (lon) => (lon + 180) / 360
export const lonDepuisU = (u) => u * 360 - 180

export function vDepuisLat(lat) {
  const la = Math.min(85.05, Math.max(-85.05, lat)) * (Math.PI / 180)
  return (1 - Math.log(Math.tan(la) + 1 / Math.cos(la)) / Math.PI) / 2
}

export function latDepuisV(v) {
  return (180 / Math.PI) * Math.atan(Math.sinh(Math.PI * (1 - 2 * v)))
}

/** Emprise lon/lat d'un rectangle en Mercator normalisé. */
export function bboxDepuisUV({ u0, v0, u1, v1 }) {
  return {
    west: lonDepuisU(Math.min(u0, u1)),
    east: lonDepuisU(Math.max(u0, u1)),
    north: latDepuisV(Math.min(v0, v1)),
    south: latDepuisV(Math.max(v0, v1)),
  }
}

/**
 * L'ÉROSION DE LA TERRE, et c'est elle qui garantit que le rivage ne bouge pas.
 *
 * Une cellule ne garde le veto que si TOUT son voisinage carré de rayon `r` est
 * terre. C'est le verdict `TERRE` de `bandeIncertaine` (src/sea-mask.js), écrit
 * ici pour une grille RECTANGULAIRE (les emprises de la fenêtre continue ne
 * sont pas carrées) et sur un tableau binaire.
 *
 * Séparable et à fenêtre glissante : deux passes en O(n), INDÉPENDANTES de `r`.
 * À z17 le rayon vaut 64 cellules ; un voisinage naïf coûterait 129² lectures
 * par cellule, soit 16 641 fois le prix.
 *
 * Bords : clamp-to-edge, la convention de `blurMask` et de `bandeIncertaine`.
 *
 * @param {Uint8Array} brut - 1 = terre, 0 = mer
 * @returns {Uint8Array} 1 = terre CERTAINE (veto), 0 sinon
 */
export function erodeTerre(brut, largeur, hauteur, r) {
  if (!(r > 0)) return brut
  const n = largeur * hauteur
  const w = 2 * r + 1
  const pinceX = (v) => (v < 0 ? 0 : v > largeur - 1 ? largeur - 1 : v)
  const pinceY = (v) => (v < 0 ? 0 : v > hauteur - 1 ? hauteur - 1 : v)
  const ligne = new Int32Array(n)
  for (let y = 0; y < hauteur; y++) {
    const o = y * largeur
    let s = 0
    for (let dx = -r; dx <= r; dx++) s += brut[o + pinceX(dx)] ? 1 : 0
    ligne[o] = s
    for (let x = 1; x < largeur; x++) {
      s -= brut[o + pinceX(x - 1 - r)] ? 1 : 0
      s += brut[o + pinceX(x + r)] ? 1 : 0
      ligne[o + x] = s
    }
  }
  const out = new Uint8Array(n)
  const total = w * w
  for (let x = 0; x < largeur; x++) {
    let s = 0
    for (let dy = -r; dy <= r; dy++) s += ligne[pinceY(dy) * largeur + x]
    out[x] = s === total ? 1 : 0
    for (let y = 1; y < hauteur; y++) {
      s -= ligne[pinceY(y - 1 - r) * largeur + x]
      s += ligne[pinceY(y + r) * largeur + x]
      out[y * largeur + x] = s === total ? 1 : 0
    }
  }
  return out
}

/** Le rayon d'érosion, en cellules — la tolérance de `sea-mask.js`, plafonnée. */
export const rayonVeto = rayonIncertitude

// ---- rasterisation (DOM) ----

// ⚠️ INJECTABLE. Les tests tournent en node : sans point d'injection, ce module
// entier deviendrait intestable et le veto ne serait vérifié qu'à l'écran.
let fabriqueCanevas = (l, h) => {
  const c = document.createElement('canvas')
  c.width = l
  c.height = h
  return c
}
export function poserFabriqueCanevas(f) {
  const avant = fabriqueCanevas
  fabriqueCanevas = f ?? avant
  return avant
}

/**
 * Peint les anneaux de terre sur la grille et rend le champ binaire NON ÉRODÉ.
 * ⚠️ Pas de flou : le veto est une décision booléenne, pas une iso-0,5 de
 * nuanceur. Un flou rendrait le bord du polygone « à moitié terre », et
 * l'érosion l'avalerait de toute façon.
 */
export function rasteriseTerre(anneaux, { u0, v0, u1, v1, largeur, hauteur }) {
  const c = fabriqueCanevas(largeur, hauteur)
  const g = c.getContext('2d', { willReadFrequently: true })
  g.fillStyle = '#000'
  g.fillRect(0, 0, largeur, hauteur)
  g.fillStyle = '#fff'
  const du = u1 - u0
  const dv = v1 - v0
  for (const anneaux2 of anneaux) {
    g.beginPath()
    for (const anneau of anneaux2) {
      for (let i = 0; i < anneau.length; i++) {
        // ⚠️ LONGITUDE CONTINUE, sans le repli antiméridien de `geo.latLonToWorld` :
        // un polygone qui s'étend sur plus de 180° se déchirerait, et la parité
        // du remplissage evenodd basculerait par bandes (le défaut « mer du Nord
        // inversée » de coast-mask.js). Ce qui sort du cadre est simplement clippé.
        const px = ((uDepuisLon(anneau[i][0]) - u0) / du) * largeur
        const py = ((vDepuisLat(anneau[i][1]) - v0) / dv) * hauteur
        if (i === 0) g.moveTo(px, py)
        else g.lineTo(px, py)
      }
      g.closePath()
    }
    g.fill('evenodd') // anneau extérieur + trous (les lacs sont des trous)
  }
  const rgba = g.getImageData(0, 0, largeur, hauteur).data
  const brut = new Uint8Array(largeur * hauteur)
  for (let i = 0; i < brut.length; i++) brut[i] = rgba[i * 4] > 127 ? 1 : 0
  return brut
}

// ---- cache ----
//
// ⚠️ MÉMOÏSÉ PAR CLÉ, ET C'EST CE QUI REND LE VETO GRATUIT AU RAFFINEMENT. Le
// quadtree redemande la MÊME tuile à chaque recuisson (changement de palette,
// de nappe, retour d'un cran) ; sans cache le veto se paierait à chaque fois.
const cache = new Map() // cle → Promise<Uint8Array|null>
const CACHE_MAX = 96
export function videCacheVeto() {
  cache.clear()
}

/**
 * LE MASQUE DE VETO d'une emprise rectangulaire en Mercator normalisé.
 *
 * @param {object} o
 * @param {number} o.u0 @param {number} o.v0 - coin nord-ouest (Mercator [0,1])
 * @param {number} o.u1 @param {number} o.v1 - coin sud-est
 * @param {number} o.largeur @param {number} o.hauteur - la grille de sortie
 * @param {number} o.metresParCellule - pas au sol d'une cellule de CETTE grille
 * @param {string} o.cle - clé de mémoïsation (l'appelant la connaît mieux que nous)
 * @returns {Promise<Uint8Array|null>} 1 = TERRE certaine ; `null` = pas d'avis,
 *   et la fusion se comporte alors exactement comme avant.
 */
export function vetoTerre(o) {
  const { cle } = o
  if (cle && cache.has(cle)) {
    const p = cache.get(cle)
    cache.delete(cle) // ré-insertion : le plus récemment utilisé passe en queue
    cache.set(cle, p)
    return p
  }
  const p = calculeVeto(o).catch((err) => {
    console.warn('veto côtier indisponible:', err)
    return null
  })
  if (cle) {
    cache.set(cle, p)
    while (cache.size > CACHE_MAX) cache.delete(cache.keys().next().value)
  }
  return p
}

async function calculeVeto({ u0, v0, u1, v1, largeur, hauteur, metresParCellule, zoom }) {
  if (!(largeur > 0) || !(hauteur > 0) || !(u1 > u0) || !(v1 > v0)) return null
  // ⚠️ HORS DU MONDE, ON S'ABSTIENT. La fenêtre continue exprime ses emprises en
  // Mercator NON BORNÉ (elle enjambe l'antiméridien en sortant de [0,1]) ;
  // `lonLatToGridTile` PINCE alors la longitude et rendrait une tuile z6 du bon
  // côté du globe pour une emprise de l'autre. Un veto de travers vaut moins que
  // pas de veto du tout — c'est la leçon des cinq faux constats de PLAT.
  if (u0 < 0 || u1 > 1 || v0 < 0 || v1 > 1) return null
  const bbox = bboxDepuisUV({ u0, v0, u1, v1 })
  const r = gridTileRange(bbox, GRID_ZOOM)
  const nTuiles = (r.x1 - r.x0 + 1) * (r.y1 - r.y0 + 1)
  // ⚠️ LE CHOIX DE SOURCE EST CELUI DE `coast-mask.js`, PAS UN AUTRE : la grille
  // OSM z6 (fine, vraie côte des baies et des estuaires) dès z9 ; Natural Earth
  // 10m en dessous, ou quand l'emprise couvre trop de tuiles z6.
  const grossier = (Number.isFinite(zoom) && zoom <= COAST_NE_MAX) || nTuiles > TUILES_Z6_MAX
  const features = grossier ? await loadLandFeatures() : await loadGridFeatures(bbox)
  const anneaux = landPolygonsInBBox(features, bbox)
  if (!anneaux.length) return null // aucune terre en vue : rien à protéger
  const brut = rasteriseTerre(anneaux, { u0, v0, u1, v1, largeur, hauteur })
  return erodeTerre(brut, largeur, hauteur, rayonVeto(metresParCellule))
}
