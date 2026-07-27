// Peak mask — « je tape Mont Blanc, je veux CETTE montagne, découpée, seule ».
//
// AUCUNE SOURCE NE DONNE LE POLYGONE D'UN SOMMET. Mesuré sur Nominatim :
//   · « Mont Blanc »   → tourism=viewpoint, géométrie Point (et le second
//     résultat est une municipalité du Québec — le classement est un piège)
//   · « Mont Ventoux » → natural=peak, géométrie Point
//   · « Massif du Mont-Blanc » → place=region, Polygon
// Les MASSIFS sont parfois cartographiés, les SOMMETS jamais. La forme d'une
// montagne doit donc être DÉRIVÉE du modèle d'élévation que l'app charge déjà :
// on lit l'altitude au sommet, on trace l'isoligne à `altitude − dénivelé`, et
// on ne garde que la boucle qui entoure le sommet.
//
// Sortie : `parts`, un MultiPolygon [polygone][anneau][lon,lat] — exactement ce
// que rendent fetchRegionMask/filterFarParts, donc consommable TEL QUEL par
// frameRegion et rasterizeMask (region-mask.js). Pas de trous : une découpe
// percée montrerait le vide sous la surface (voir region-skirt.js).
//
// Module PUR : aucun DOM, aucun réseau à l'import. La recherche du sommet
// (findPeak) accepte un `fetch` injecté.

import { TERRAIN_SIZE } from './terrain.js'
import { latLonToWorld, worldToLatLon } from './geo.js'

// ---------------------------------------------------------------- réglages
//
// LE DÉNIVELÉ NE PEUT PAS ÊTRE UNE CONSTANTE EN MÈTRES. Le Mont Blanc culmine à
// 4808 m au-dessus d'une vallée à ~1000, le Ventoux à 1909 au-dessus d'une
// plaine à ~200 : retirer 800 m rogne une calotte ridicule sur le premier et
// découpe la moitié du massif du second. La règle est RELATIVE au RELIEF LOCAL
// (sommet − bas de la dalle), ce qui la rend aussi valable au niveau de la mer
// (volcan insulaire) que sur un haut plateau — là où une fraction de l'altitude
// ABSOLUE ferait n'importe quoi (un piton de 200 m sur un plateau à 4000 aurait
// demandé un retrait de 2400 m, soit une isoligne sous le plateau entier).
export const DROP_RATIO = 0.6 // fraction du relief local retirée au sommet
export const DROP_MIN = 0.15 // départ de la descente (calotte serrée)
export const DROP_STEPS = 10 // paliers entre DROP_MIN et DROP_RATIO
export const BASE_PERCENTILE = 0.05 // le « bas » local : 5ᵉ centile de la dalle
export const SNAP_PX = 4 // rayon de recalage du nœud OSM sur le max du MNT

// Sentinelle « hors dalle » du traceur d'isolignes. Elle REMBOURRE la grille
// d'une couronne très basse : sans elle, un sommet dont l'isoligne sort du bloc
// rendrait une polyligne OUVERTE, impossible à remplir — le masque serait vide
// et le relief entièrement effacé. Avec, la boucle longe le bord de la dalle et
// reste fermée ; l'appelant est prévenu par `clipped`.
const OUT = -1e7

// Les points d'intersection sont poussés à l'intérieur des arêtes : un sommet
// de cellule EXACTEMENT à l'altitude de l'isoligne (ça arrive — le Terrarium
// décode par pas de 1/256 m) ferait coïncider deux points d'arêtes différentes
// et le chaînage des boucles partirait en vrille.
const EDGE_EPS = 1e-6

// ---------------------------------------------------------------- isolignes

// Marching-squares sur un champ scalaire brut (le MNT), rendu en BOUCLES
// FERMÉES et non en segments épars.
//
// Pourquoi pas traceSkirt (region-skirt.js) ? Il fait bien du marching-squares,
// mais (1) il lit un canevas de masque via getImageData — donc du DOM, alors
// qu'on part ici du tableau d'altitudes, (2) il rend des segments INDÉPENDANTS
// (« no loop stitching needed » : chaque segment devient un quad de jupe) alors
// qu'il nous faut des anneaux fermés pour tester « qui contient le sommet » et
// pour remplir un polygone, et (3) il referme au bord du bloc par des segments
// ajoutés après coup, ce qui ne se chaîne pas. Les deux besoins ne se
// recouvrent pas ; le traceur ci-dessous est orienté (le dedans est toujours du
// même côté), ce qui permet le chaînage.
export function traceContour(field, size, level) {
  const v = (x, y) => (x < 0 || y < 0 || x >= size || y >= size ? OUT : field[y * size + x])
  // t borné : voir EDGE_EPS
  const cut = (va, vb) => {
    const d = vb - va
    if (!d) return 0.5
    const t = (level - va) / d
    return t < EDGE_EPS ? EDGE_EPS : t > 1 - EDGE_EPS ? 1 - EDGE_EPS : t
  }
  const segs = []
  // La grille court de −1 à size−1 : la couronne de rembourrage (OUT) est
  // parcourue, c'est elle qui referme les boucles au bord de la dalle.
  for (let j = -1; j < size; j++) {
    for (let i = -1; i < size; i++) {
      const tl = v(i, j)
      const tr = v(i + 1, j)
      const br = v(i + 1, j + 1)
      const bl = v(i, j + 1)
      let c = 0
      if (tl >= level) c |= 8
      if (tr >= level) c |= 4
      if (br >= level) c |= 2
      if (bl >= level) c |= 1
      if (c === 0 || c === 15) continue
      const top = () => [i + cut(tl, tr), j]
      const right = () => [i + 1, j + cut(tr, br)]
      const bottom = () => [i + cut(bl, br), j + 1]
      const left = () => [i, j + cut(tl, bl)]
      // Orientation : le segment PART de l'arête où le tour du carré (tl→tr→
      // br→bl, sens horaire) passe dehors→dedans et ARRIVE sur celle où il
      // passe dedans→dehors. Le dedans reste donc toujours du même côté, et
      // deux cellules voisines produisent des extrémités qui se répondent —
      // c'est ce qui rend le chaînage possible.
      const push = (a, b) => segs.push([a, b])
      switch (c) {
        case 1: push(bottom(), left()); break
        case 2: push(right(), bottom()); break
        case 3: push(right(), left()); break
        case 4: push(top(), right()); break
        case 6: push(top(), bottom()); break
        case 7: push(top(), left()); break
        case 8: push(left(), top()); break
        case 9: push(bottom(), top()); break
        case 11: push(right(), top()); break
        case 12: push(left(), right()); break
        case 13: push(bottom(), right()); break
        case 14: push(left(), bottom()); break
        // Selles : deux traversées dans la même cellule. C'est la valeur au
        // CENTRE qui dit si les deux coins « dedans » se rejoignent ou non ;
        // choisir au hasard croiserait les deux brins et fabriquerait des
        // boucles en huit.
        case 5:
          if ((tl + tr + br + bl) / 4 >= level) { push(top(), left()); push(bottom(), right()) }
          else { push(top(), right()); push(bottom(), left()) }
          break
        case 10:
          if ((tl + tr + br + bl) / 4 >= level) { push(right(), top()); push(left(), bottom()) }
          else { push(left(), top()); push(right(), bottom()) }
          break
      }
    }
  }
  return chainRings(segs)
}

// Chaînage des segments orientés en anneaux fermés. Les extrémités partagées
// par deux cellules sont calculées par la MÊME expression des deux côtés, donc
// bit à bit identiques : une clé texte suffit, pas besoin de tolérance.
function chainRings(segs) {
  const key = (p) => `${p[0]},${p[1]}`
  const byStart = new Map()
  for (let i = 0; i < segs.length; i++) {
    const k = key(segs[i][0])
    const l = byStart.get(k)
    if (l) l.push(i)
    else byStart.set(k, [i])
  }
  const used = new Uint8Array(segs.length)
  const rings = []
  for (let i = 0; i < segs.length; i++) {
    if (used[i]) continue
    used[i] = 1
    const ring = [segs[i][0]]
    let cur = i
    for (let guard = 0; guard <= segs.length; guard++) {
      const end = segs[cur][1]
      ring.push(end)
      const list = byStart.get(key(end))
      let nxt = -1
      if (list) for (const j of list) if (!used[j]) { nxt = j; break }
      if (nxt < 0) break
      used[nxt] = 1
      cur = nxt
    }
    // filet : le rembourrage garantit la fermeture, on la force si un cas
    // dégénéré passait quand même à travers
    if (ring.length < 4) continue
    if (key(ring[0]) !== key(ring[ring.length - 1])) ring.push([ring[0][0], ring[0][1]])
    rings.push(ring)
  }
  return rings
}

// Surface d'un anneau (formule du lacet), en pixels², sens de parcours ignoré.
export function ringArea(ring) {
  let s = 0
  for (let i = 0, j = ring.length - 1; i < ring.length; j = i++) {
    s += (ring[j][0] + ring[i][0]) * (ring[j][1] - ring[i][1])
  }
  return Math.abs(s) / 2
}

function pointInRing(x, y, ring) {
  let inside = false
  for (let i = 0, j = ring.length - 1; i < ring.length; j = i++) {
    const [xi, yi] = ring[i]
    const [xj, yj] = ring[j]
    if (yi > y !== yj > y && x < ((xj - xi) * (y - yi)) / (yj - yi) + xi) inside = !inside
  }
  return inside
}

// LA boucle du sommet. Une isoligne dans un massif rend PLUSIEURS boucles à la
// même altitude (les sommets voisins) : on ne garde que celle qui entoure le
// point sommital, et la plus SERRÉE d'entre elles quand elles s'emboîtent (un
// cratère rend un anneau extérieur et un anneau intérieur — c'est l'intérieur
// le plus proche du sommet qui décrit la montagne).
export function ringContaining(rings, x, y) {
  let best = null
  let bestA = Infinity
  for (const r of rings) {
    if (!pointInRing(x, y, r)) continue
    const a = ringArea(r)
    if (a < bestA) {
      bestA = a
      best = r
    }
  }
  return best
}

// ---------------------------------------------------------------- bassin

// Remplissage 4-connexe des pixels ≥ level depuis le sommet. Sert à MESURER la
// zone qu'une isoligne enfermerait sans avoir à la tracer : c'est O(surface) au
// lieu de O(dalle²), donc on peut sonder une dizaine de niveaux pour rien.
export function basinFill(field, size, sx, sy, level) {
  const seen = new Uint8Array(size * size)
  const stack = [sy * size + sx]
  seen[stack[0]] = 1
  let area = 0
  let touchesBorder = false
  let minX = size
  let maxX = -1
  let minY = size
  let maxY = -1
  while (stack.length) {
    const p = stack.pop()
    const x = p % size
    const y = (p - x) / size
    if (field[p] < level) continue
    area++
    if (x < minX) minX = x
    if (x > maxX) maxX = x
    if (y < minY) minY = y
    if (y > maxY) maxY = y
    if (x === 0 || y === 0 || x === size - 1 || y === size - 1) touchesBorder = true
    if (x > 0 && !seen[p - 1]) { seen[p - 1] = 1; stack.push(p - 1) }
    if (x < size - 1 && !seen[p + 1]) { seen[p + 1] = 1; stack.push(p + 1) }
    if (y > 0 && !seen[p - size]) { seen[p - size] = 1; stack.push(p - size) }
    if (y < size - 1 && !seen[p + size]) { seen[p + size] = 1; stack.push(p + size) }
  }
  return { area, touchesBorder, minX, maxX, minY, maxY }
}

// ---------------------------------------------------------------- lectures MNT

// Le nœud natural=peak d'OSM tombe rarement pile sur le pixel le plus haut du
// MNT (relevé GPS d'un côté, tuile d'élévation de l'autre). Sans ce recalage,
// l'altitude lue est en dessous du sommet réel et l'isoligne calculée à partir
// d'elle enferme un peu n'importe quoi.
export function snapToSummit(field, size, x, y, radius = SNAP_PX) {
  let bx = Math.min(size - 1, Math.max(0, Math.round(x)))
  let by = Math.min(size - 1, Math.max(0, Math.round(y)))
  // ⚠️ les bornes sont FIGÉES avant la boucle. Les recalculer depuis bx/by
  // pendant qu'on les déplace faisait glisser la fenêtre de proche en proche :
  // le recalage remontait alors toute la pente jusqu'au plus haut sommet de la
  // dalle, et demander une aiguille secondaire rendait le Mont Blanc.
  const i0 = Math.max(0, bx - radius)
  const i1 = Math.min(size - 1, bx + radius)
  const j0 = Math.max(0, by - radius)
  const j1 = Math.min(size - 1, by + radius)
  let best = field[by * size + bx]
  for (let j = j0; j <= j1; j++) {
    for (let i = i0; i <= i1; i++) {
      const v = field[j * size + i]
      if (v > best) { best = v; bx = i; by = j }
    }
  }
  return { x: bx, y: by, ele: best }
}

// Le « bas » local. Un centile bas plutôt que le minimum : un seul pixel de
// fond marin ou de trou de données dicterait sinon tout le dénivelé. Échantillonné
// à pas régulier — trier 590 000 flottants à chaque appel n'apporterait rien.
export function lowPercentile(field, p = BASE_PERCENTILE, maxSamples = 65536) {
  const stride = Math.max(1, Math.ceil(field.length / maxSamples))
  const s = []
  for (let i = 0; i < field.length; i += stride) if (Number.isFinite(field[i])) s.push(field[i])
  if (!s.length) return 0
  s.sort((a, b) => a - b)
  return s[Math.min(s.length - 1, Math.floor(p * s.length))]
}

// ---------------------------------------------------------------- géoréférencement
// Coordonnées de GRILLE : (0,0) = centre du premier pixel du MNT. geo.js compte
// lui en pixels CONTINUS depuis le coin du canevas, d'où le demi-pixel.

export function lonLatToDemPixel(dem, lat, lon) {
  const w = latLonToWorld(dem, lat, lon)
  return {
    x: (w.x / TERRAIN_SIZE + 0.5) * dem.size - 0.5,
    y: (w.z / TERRAIN_SIZE + 0.5) * dem.size - 0.5,
  }
}

export function demPixelToLonLat(dem, x, y) {
  const wx = ((x + 0.5) / dem.size - 0.5) * TERRAIN_SIZE
  const wz = ((y + 0.5) / dem.size - 0.5) * TERRAIN_SIZE
  const { lat, lon } = worldToLatLon(dem, wx, wz)
  return [lon, lat]
}

// ---------------------------------------------------------------- choix du niveau

// Descente par paliers depuis une calotte serrée jusqu'à DROP_RATIO du relief,
// avec deux garde-fous :
//
//  · LE BORD DE LA DALLE. Dès qu'un palier fait sortir le bassin du bloc, on
//    en reste au précédent : mieux vaut une montagne un peu plus haut découpée
//    mais ENTIÈRE qu'une découpe coupée net par le carré du MNT.
//  · LA FUSION AVEC UN VOISIN (optionnelle, `mergeFactor`). En descendant, la
//    surface d'un cône croît comme le carré du dénivelé ; on compare donc la
//    croissance observée à CETTE attente et pas à une constante, sinon le
//    premier palier déclencherait déjà l'alarme. Désactivée par défaut : sur un
//    massif réel (Mont Blanc et ses satellites à 4000 m) elle se déclenche sur
//    des épaules qui font partie de la montagne et rend une calotte minuscule.
export function chooseContourLevel(field, size, seed, ele, base, opts = {}) {
  const {
    dropRatio = DROP_RATIO,
    dropMin = DROP_MIN,
    steps = DROP_STEPS,
    mergeFactor = null,
    borderGuard = true,
  } = opts
  const relief = ele - base
  const lo = Math.min(dropMin, dropRatio)
  const hi = Math.max(dropMin, dropRatio)
  let best = null
  let merged = false
  for (let k = 0; k < steps; k++) {
    const f = steps === 1 ? hi : lo + ((hi - lo) * k) / (steps - 1)
    const level = ele - f * relief
    const b = basinFill(field, size, seed.x, seed.y, level)
    if (best) {
      if (mergeFactor) {
        // croissance ATTENDUE d'un cône entre deux paliers : (f/f₋₁)²
        const attendu = (f / best.f) ** 2
        if (b.area > mergeFactor * attendu * best.area) {
          merged = true
          break
        }
      }
      if (borderGuard && b.touchesBorder && !best.touchesBorder) break
    }
    best = { f, level, drop: f * relief, area: b.area, touchesBorder: b.touchesBorder }
  }
  return { ...best, merged }
}

// ---------------------------------------------------------------- API publique

// Découpe le relief autour d'un sommet.
//   peakMask(dem, { lat, lon, name?, ele? }, opts?) →
//     { parts, ring, level, ele, drop, base, loops, area, clipped, merged, name } | null
//
// `dem` est la dalle chargée par dem.js, lue EXACTEMENT comme le fait
// region-mask.js : `dem.data` (Float32Array size², mètres, ligne 0 au nord),
// `dem.size`, plus le géoréférencement (zoom / originTileX / originTileY /
// tilePx) que geo.js consomme.
//
// `parts` est un MultiPolygon [polygone][anneau][lon,lat] — le même format que
// filterFarParts, donc directement utilisable par frameRegion et rasterizeMask.
//
// Rend null quand il n'y a rien à découper : sommet hors dalle, plateau (aucun
// relief), ou isoligne dégénérée.
export function peakMask(dem, peak, opts = {}) {
  if (!dem?.data || !dem.size || !peak || !Number.isFinite(peak.lat) || !Number.isFinite(peak.lon)) return null
  const { size, data } = dem
  const p = lonLatToDemPixel(dem, peak.lat, peak.lon)
  if (!(p.x >= 0 && p.y >= 0 && p.x <= size - 1 && p.y <= size - 1)) return null

  const seed = snapToSummit(data, size, p.x, p.y, opts.snapPx ?? SNAP_PX)
  // Le bas de référence est plafonné au niveau de la mer : sur une côte, le 5ᵉ
  // centile plonge dans la bathymétrie (−3000 m et plus) et le « relief local »
  // d'un piton de 500 m serait annoncé à 3500.
  const base = Math.max(0, lowPercentile(data, opts.basePercentile ?? BASE_PERCENTILE))
  const relief = seed.ele - base
  if (!(relief > 0)) return null

  let level
  let drop
  let merged = false
  if (Number.isFinite(opts.level)) {
    level = opts.level
    drop = seed.ele - level
  } else if (Number.isFinite(opts.drop)) {
    drop = opts.drop
    level = seed.ele - drop
  } else {
    const c = chooseContourLevel(data, size, seed, seed.ele, base, opts)
    if (!c || !Number.isFinite(c.level)) return null
    level = c.level
    drop = c.drop
    merged = c.merged
  }

  const rings = traceContour(data, size, level)
  const ring = ringContaining(rings, seed.x, seed.y)
  if (!ring || ring.length < 4) return null

  // L'anneau touche-t-il la couronne de rembourrage ? Alors la montagne déborde
  // du bloc : la découpe est honnête mais TRONQUÉE, et l'appelant a tout intérêt
  // à recharger une dalle plus large avant de l'afficher.
  const clipped = ring.some(([x, y]) => x <= 1e-3 || y <= 1e-3 || x >= size - 1 - 1e-3 || y >= size - 1 - 1e-3)

  return {
    parts: [[ring.map(([x, y]) => demPixelToLonLat(dem, x, y))]],
    ring,
    level,
    drop,
    base,
    ele: seed.ele,
    summitPx: { x: seed.x, y: seed.y },
    loops: rings.length,
    area: ringArea(ring),
    // emprise au sol du plus grand côté, en mètres — de quoi juger la découpe
    spanMeters: ringSpanMeters(ring, dem),
    clipped,
    merged,
    name: peak.name || null,
  }
}

function ringSpanMeters(ring, dem) {
  const mpp = dem.metersPerPixel
  if (!Number.isFinite(mpp)) return null
  let x0 = Infinity, x1 = -Infinity, y0 = Infinity, y1 = -Infinity
  for (const [x, y] of ring) {
    if (x < x0) x0 = x
    if (x > x1) x1 = x
    if (y < y0) y0 = y
    if (y > y1) y1 = y
  }
  return { x: (x1 - x0) * mpp, y: (y1 - y0) * mpp }
}

// ---------------------------------------------------------------- recherche
//
// POURQUOI OVERPASS ET PAS NOMINATIM. Mesuré en direct sur les deux services :
//
//   Nominatim « Mont Blanc » → 1. « Mont Blanc / Monte Bianco » tourism=
//     viewpoint (Point), 2. Mont-Blanc boundary=administrative (Québec), puis
//     trois collines de Picardie à 50 m d'altitude. Il mêle tous les types
//     d'objets, et surtout il ne rend PAS l'altitude — le seul discriminant
//     sérieux entre deux homonymes.
//   Overpass `node["natural"="peak"]["name"="Mont Blanc"]` → 12 nœuds, dont
//     un au Texas (401 m) et un au Québec (1063 m)… et PAS le vrai : le sommet
//     est frontalier, son `name` OSM est « Mont Blanc / Monte Bianco ». Il ne
//     se trouve que par `name:fr` / `alt_name`, d'où l'UNION sur les clés de nom.
//
// Overpass gagne parce qu'il sait filtrer sur le TYPE (natural=peak) et qu'il
// rend `ele`. Le projet parle déjà à cet endpoint (peaks.js, transports.js).
//
// ⚠️ LA REGEX GLOBALE EST INUTILISABLE : `["name"~"Ventoux",i]` sur tous les
// sommets du monde répond 504 après 43 s (mesuré). Elle n'est lancée que
// BORNÉE par une emprise, obtenue en second recours auprès de Nominatim — qui
// est mauvais en classement mais bon pour rapprocher « Ventoux » des communes
// qui l'entourent. Nominatim LOCALISE, Overpass QUALIFIE.

const OVERPASS = 'https://overpass-api.de/api/interpreter'
const NOMINATIM = 'https://nominatim.openstreetmap.org/search'

// Clés de nom interrogées en union. Toutes indexées côté serveur : la requête
// répond en une poignée de secondes là où la regex globale expire.
export const PEAK_NAME_KEYS = ['name', 'name:fr', 'name:en', 'alt_name', 'official_name', 'int_name']

// Demi-côté de l'emprise ouverte autour d'un point rendu par Nominatim (~39 km
// en latitude). Assez large pour couvrir un sommet depuis une commune voisine,
// assez serré pour que la regex bornée reste rapide.
export const NEAR_DEG = 0.35

const escStr = (s) => String(s).replace(/\\/g, '\\\\').replace(/"/g, '\\"')
const escRe = (s) => escStr(s).replace(/[.*+?^${}()|[\]]/g, '\\$&')

// `exact` (défaut) : union sur PEAK_NAME_KEYS, indexée, globale sans danger.
// `exact:false` : regex insensible à la casse — À N'UTILISER QU'AVEC `bboxes`.
export function overpassPeakQuery(name, { bboxes = [], exact = true, limit = 60, timeout = 60 } = {}) {
  const n = String(name).trim()
  const boxes = bboxes.length ? bboxes.map((b) => `(${b.s},${b.w},${b.n},${b.e})`) : ['']
  const sels = exact ? PEAK_NAME_KEYS.map((k) => `["${k}"="${escStr(n)}"]`) : [`["name"~"${escRe(n)}",i]`]
  const clauses = []
  for (const box of boxes) for (const sel of sels) clauses.push(`node["natural"="peak"]${sel}${box};`)
  return `[out:json][timeout:${timeout}];(${clauses.join('')});out body ${limit};`
}

// Comparaison de noms tolérante : casse, accents, tirets et apostrophes.
// « Mont-Blanc », « MONT BLANC » et « mont blanc » sont le même nom.
const norm = (s) =>
  String(s)
    .normalize('NFD')
    .replace(/[̀-ͯ]/g, '')
    .toLowerCase()
    .replace(/['’\-_.]/g, ' ')
    .replace(/\s+/g, ' ')
    .trim()

// Toutes les façons dont OSM peut nommer ce sommet : les clés de nom, ET les
// morceaux d'un nom BILINGUE (« Mont Blanc / Monte Bianco »). Sans ce découpage,
// le plus haut sommet d'Europe ne comptait que comme correspondance PARTIELLE
// et se faisait doubler par le Mont Blanc de Matane, 1063 m.
// Le séparateur doit avoir des espaces autour : « Mont-Blanc » n'est pas deux noms.
function nameVariants(tags) {
  const out = []
  for (const k of Object.keys(tags)) {
    if (k !== 'name' && k !== 'alt_name' && k !== 'official_name' && k !== 'int_name' && k !== 'loc_name' &&
        !k.startsWith('name:') && !k.startsWith('alt_name:')) continue
    for (const part of String(tags[k]).split(/\s*[/|]\s*|\s+[-–—]\s+/)) {
      const p = part.trim()
      if (p) out.push(p)
    }
  }
  return out
}

// Classement des candidats. L'ORDRE RENDU PAR LE SERVEUR N'EST PAS UN
// CLASSEMENT : il faut trier nous-mêmes.
//   1. nom exact avant nom partiel (« Everest » ne doit pas remonter sur
//      « Ventoux » au prétexte qu'il est plus haut) ;
//   2. puis l'ALTITUDE, décroissante — c'est elle qui met les 4807 m de Haute-
//      Savoie devant les 1063 m du Mont Blanc québécois, tous deux natural=peak
//      et tous deux nommés « Mont Blanc » ;
//   3. puis la présence d'un lien wikidata/wikipedia, simple départage.
export function rankPeakCandidates(elements, name) {
  const want = norm(name)
  if (!want) return []
  const out = []
  const vus = new Set()
  for (const e of elements || []) {
    const t = e?.tags
    if (!t || t.natural !== 'peak' || !t.name) continue
    if (!Number.isFinite(e.lat) || !Number.isFinite(e.lon)) continue
    // l'union de clauses rend le même nœud plusieurs fois
    const cle = e.id ?? `${e.lat},${e.lon}`
    if (vus.has(cle)) continue
    vus.add(cle)
    let exact = 0
    for (const v of nameVariants(t)) {
      const n = norm(v)
      if (n === want) { exact = 2; break }
      if (n.includes(want) || want.includes(n)) exact = 1
    }
    if (!exact) continue
    const ele = parseFloat(String(t.ele).replace(',', '.'))
    out.push({
      name: t.name,
      lat: e.lat,
      lon: e.lon,
      ele: Number.isFinite(ele) ? ele : null,
      exact,
      wiki: !!(t.wikidata || t.wikipedia),
      id: e.id ?? null,
    })
  }
  return out.sort(
    (a, b) => b.exact - a.exact || (b.ele ?? -1) - (a.ele ?? -1) || Number(b.wiki) - Number(a.wiki)
  )
}

// Le meilleur sommet pour un nom, ou null. Ne jette JAMAIS : Overpass tombe
// régulièrement en 429/504 (mesuré sur quatre miroirs le même jour), et la
// recherche ne doit pas emporter l'app avec elle. `fetchImpl` est injectable.
//
// Deux étages, voir l'entête de section :
//   1. union des noms exacts, globale — « Mont Blanc », « Mont Ventoux »,
//      « Mont Blanc du Tacul » se résolvent là, en une requête ;
//   2. si rien : Nominatim localise le mot, et une regex BORNÉE aux emprises
//      rendues cherche le sommet sur place — « Ventoux » → Mont Ventoux 1910 m,
//      « Grand Ballon » → 1424 m (mesurés). Un nom qu'aucun des deux ne
//      rapproche du bon endroit rend null : c'est assumé, pas masqué.
//
// ⚠️ CHAQUE ÉTAGE TOMBE SEUL, et c'est LOAD-BEARING. Un seul `try` autour des
// deux faisait sortir la fonction au premier hoquet d'Overpass, donc SANS
// jamais lancer le repli — celui-là même qui existe pour ça. Mesuré sur la
// requête « Mont Blanc » : 14 éléments en 1,3 s, puis 504 après 31 s sur le
// même serveur une minute plus tard ; corps de requête identique bit à bit,
// classement rendant bien « Mont Blanc / Monte Bianco » 4807,3 m en tête sur
// trois miroirs indépendants. Le sommet était donc introuvable par intermittence
// alors que l'étage 2 le résout en 3,4 s (Nominatim 0,3 s + regex bornée 3,1 s).
// « Ventoux » masquait la panne : son étage 1 répond 200 avec zéro
// correspondance — il ne jette pas, donc le repli s'exécutait toujours.
export async function findPeak(
  name,
  { fetchImpl = fetch, endpoint = OVERPASS, nominatim = NOMINATIM, limit = 60, nearDeg = NEAR_DEG } = {}
) {
  const n = String(name || '').trim()
  if (!n) return null
  const askOverpass = async (opts) => {
    // PAS d'en-tete Content-Type : avec « application/x-www-form-urlencoded »
    // explicite, Overpass repond un document d'ERREUR XML, `.json()` leve, et
    // findPeak rendait null sur une requete pourtant juste — « Mont Blanc »
    // retombait alors sur la Haute-Savoie. Sans l'en-tete, la meme requete rend
    // le bon sommet en 5 s. C'est la convention deja eprouvee par transports.js.
    const r = await fetchImpl(endpoint, {
      method: 'POST',
      body: `data=${encodeURIComponent(overpassPeakQuery(n, { limit, ...opts }))}`,
    })
    if (!r.ok) throw new Error(`overpass → HTTP ${r.status}`)
    return rankPeakCandidates((await r.json()).elements, n)
  }
  // Le filet est posé étage par étage, jamais autour des deux : voir l'entête.
  // Un étage en panne rend null et laisse le suivant tenter sa chance ; un
  // étage qui répond « rien » rend une liste vide. Les deux mènent au repli,
  // mais seul le second est une réponse.
  const tenter = async (quoi, fn) => {
    try {
      return await fn()
    } catch (err) {
      console.warn(`findPeak (${quoi}) :`, err.message)
      return null
    }
  }

  const exact = await tenter('nom exact', () => askOverpass({ exact: true }))
  if (exact?.length) return exact[0]

  // ÉTAGE 2 — localiser d'abord, qualifier ensuite.
  const hits = await tenter('nominatim', async () => {
    const r = await fetchImpl(`${nominatim}?format=jsonv2&limit=3&q=${encodeURIComponent(n)}`, {
      headers: { Accept: 'application/json' },
    })
    if (!r.ok) throw new Error(`nominatim → HTTP ${r.status}`)
    return await r.json()
  })
  const bboxes = []
  for (const h of hits || []) {
    const la = parseFloat(h.lat)
    const lo = parseFloat(h.lon)
    if (!Number.isFinite(la) || !Number.isFinite(lo)) continue
    bboxes.push({ s: la - nearDeg, w: lo - nearDeg, n: la + nearDeg, e: lo + nearDeg })
  }
  // sans emprise, pas de regex : elle expirerait (voir l'entête)
  if (!bboxes.length) return null
  const large = await tenter('regex bornée', () => askOverpass({ exact: false, bboxes }))
  return large?.[0] || null
}
