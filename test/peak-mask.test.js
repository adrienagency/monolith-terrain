import { test } from 'node:test'
import assert from 'node:assert/strict'
import {
  traceContour,
  ringArea,
  ringContaining,
  basinFill,
  snapToSummit,
  lowPercentile,
  lonLatToDemPixel,
  demPixelToLonLat,
  peakMask,
  overpassPeakQuery,
  rankPeakCandidates,
  findPeak,
} from '../src/peak-mask.js'
import { frameRegion } from '../src/region-mask.js'
import { latLonToTile } from '../src/geo.js'

// ---------------------------------------------------------------- fixtures
// MNT synthétiques : un cône, deux cônes voisins, un plateau. Aucun réseau.

const TILE = 128

// Dalle MNT synthétique calquée sur dem.js : une seule tuile, georef exacte.
function makeDem(data, size, { lat = 45.8326, lon = 6.8652, zoom = 12 } = {}) {
  const t = latLonToTile(lat, lon, zoom)
  const metersPerPixel = ((156543.03392 * Math.cos((lat * Math.PI) / 180)) / 2 ** zoom) * (256 / size)
  return {
    data,
    size,
    tilePx: size,
    zoom,
    lat,
    lon,
    metersPerPixel,
    extentMeters: metersPerPixel * size,
    originTileX: Math.floor(t.x),
    originTileY: Math.floor(t.y),
  }
}

// cône parfait : sommet `peak` en (cx,cy), plaine à `base` au-delà de `radius`
function coneField(size, cx, cy, radius, peak, base = 0) {
  const f = new Float32Array(size * size)
  for (let y = 0; y < size; y++) {
    for (let x = 0; x < size; x++) {
      const d = Math.hypot(x - cx, y - cy)
      f[y * size + x] = base + Math.max(0, 1 - d / radius) * (peak - base)
    }
  }
  return f
}

const maxOf = (a, b) => {
  const o = new Float32Array(a.length)
  for (let i = 0; i < a.length; i++) o[i] = Math.max(a[i], b[i])
  return o
}

// ---------------------------------------------------------------- isolignes

test('un cône rend UNE boucle fermée, au rayon que dit l’altitude', () => {
  const size = 64
  const rings = traceContour(coneField(size, 32, 32, 24, 1000), size, 500)
  assert.equal(rings.length, 1, `une seule boucle attendue, ${rings.length} obtenues`)
  const r = rings[0]
  assert.deepEqual(r[0], r[r.length - 1], 'la boucle doit être fermée')
  // isoligne à 50 % de la hauteur d'un cône → moitié du rayon
  for (const [x, y] of r) {
    const d = Math.hypot(x - 32, y - 32)
    assert.ok(Math.abs(d - 12) < 1.2, `rayon ${d.toFixed(2)}, attendu ~12`)
  }
})

test('deux sommets voisins font DEUX boucles à la même altitude', () => {
  const size = 200
  const f = maxOf(coneField(size, 70, 100, 40, 1000), coneField(size, 130, 100, 40, 900))
  const rings = traceContour(f, size, 500) // au-dessus du col (~237 m)
  assert.equal(rings.length, 2, `deux boucles attendues, ${rings.length}`)
  const bas = traceContour(f, size, 150) // sous le col : les deux fusionnent
  assert.equal(bas.length, 1, `une seule boucle sous le col, ${bas.length}`)
})

// LE REMBOURRAGE EST VISIBLE ICI. Un plateau entièrement au-dessus de
// l'isoligne n'a pas de contour « dans » la dalle : la seule limite est le bord
// du bloc, et c'est bien ce que rend le traceur — une boucle qui longe la
// dalle. C'est le comportement voulu (sinon un relief débordant rendrait une
// polyligne ouverte, donc un masque vide et un relief effacé). peakMask, lui,
// refuse le plateau en amont : sans relief, il n'y a pas de montagne à isoler.
test('un plateau : rien à tracer en dessous, le bord du bloc au-dessus', () => {
  const size = 32
  const plat = new Float32Array(size * size).fill(500)
  assert.equal(traceContour(plat, size, 600).length, 0, 'tout est en dessous : rien à tracer')
  const bord = traceContour(plat, size, 400)
  assert.equal(bord.length, 1, 'tout est au-dessus : la boucle est le bord de la dalle')
  const xs = bord[0].map((p) => p[0])
  assert.ok(Math.min(...xs) <= 0 && Math.max(...xs) >= size - 1)
})

test('un relief qui déborde de la dalle rend quand même une boucle FERMÉE', () => {
  // sommet collé au bord ouest : sans rembourrage, l'isoligne serait une
  // polyligne ouverte et le masque ne pourrait pas être rempli
  const size = 64
  const rings = traceContour(coneField(size, 4, 32, 24, 1000), size, 500)
  assert.equal(rings.length, 1)
  const r = rings[0]
  assert.deepEqual(r[0], r[r.length - 1], 'fermée malgré la coupe au bord')
  assert.ok(Math.min(...r.map((p) => p[0])) <= 0, 'elle longe bien le bord de la dalle')
})

test('ringContaining garde la boucle qui entoure le point, la plus serrée', () => {
  const grand = [[0, 0], [100, 0], [100, 100], [0, 100], [0, 0]]
  const petit = [[40, 40], [60, 40], [60, 60], [40, 60], [40, 40]]
  const ailleurs = [[200, 200], [210, 200], [210, 210], [200, 210], [200, 200]]
  assert.equal(ringContaining([grand, petit, ailleurs], 50, 50), petit, 'la plus intérieure')
  assert.equal(ringContaining([grand, petit, ailleurs], 10, 10), grand)
  assert.equal(ringContaining([petit, ailleurs], 10, 10), null)
})

test('ringArea mesure une surface, sens de parcours indifférent', () => {
  const carre = [[0, 0], [10, 0], [10, 10], [0, 10], [0, 0]]
  assert.ok(Math.abs(ringArea(carre) - 100) < 1e-9)
  assert.ok(Math.abs(ringArea([...carre].reverse()) - 100) < 1e-9)
})

// ---------------------------------------------------------------- bassin

test('basinFill ne remplit que le bassin du sommet visé', () => {
  const size = 200
  const f = maxOf(coneField(size, 70, 100, 40, 1000), coneField(size, 130, 100, 40, 900))
  const haut = basinFill(f, size, 70, 100, 500)
  assert.ok(!haut.touchesBorder)
  assert.ok(haut.maxX < 110, `le bassin ne doit pas atteindre le voisin (maxX ${haut.maxX})`)
  const bas = basinFill(f, size, 70, 100, 150) // sous le col
  assert.ok(bas.maxX > 130, 'sous le col, le bassin absorbe le voisin')
  assert.ok(bas.area > 2 * haut.area)
})

test('basinFill signale qu’il touche le bord de la dalle', () => {
  const size = 64
  const f = coneField(size, 4, 32, 24, 1000)
  assert.equal(basinFill(f, size, 4, 32, 900).touchesBorder, false)
  assert.equal(basinFill(f, size, 4, 32, 500).touchesBorder, true)
})

test('snapToSummit recale le nœud OSM sur le vrai maximum du MNT', () => {
  const size = 32
  const f = coneField(size, 16, 16, 10, 1000)
  // le nœud natural=peak d'OSM tombe rarement pile sur le pixel le plus haut
  const s = snapToSummit(f, size, 19, 17, 4)
  assert.equal(s.x, 16)
  assert.equal(s.y, 16)
  assert.ok(Math.abs(s.ele - 1000) < 1e-3)
  // hors rayon, on ne bouge pas jusqu'au sommet
  const loin = snapToSummit(f, size, 25, 16, 2)
  assert.ok(loin.x > 20, 'le recalage reste local')
})

test('lowPercentile décrit la plaine, pas le sommet', () => {
  const size = 64
  const f = coneField(size, 32, 32, 20, 3000, 800)
  assert.ok(Math.abs(lowPercentile(f, 0.05) - 800) < 1, 'le bas de la vallée')
})

// ---------------------------------------------------------------- géoréférencement

test('pixel MNT ↔ lon/lat fait l’aller-retour', () => {
  const size = 128
  const dem = makeDem(new Float32Array(size * size), size)
  for (const [px, py] of [[0, 0], [64, 64], [127, 127], [10, 100]]) {
    const [lon, lat] = demPixelToLonLat(dem, px, py)
    const back = lonLatToDemPixel(dem, lat, lon)
    assert.ok(Math.abs(back.x - px) < 1e-6, `x ${back.x} ≠ ${px}`)
    assert.ok(Math.abs(back.y - py) < 1e-6, `y ${back.y} ≠ ${py}`)
  }
})

// L'AVANT/APRÈS de la correction 3×3, verrouillé plutôt que raconté.
//
// Un MNT d'emprise 3×3 couvre 168 unités monde pour 3×size pixels. Avec
// TERRAIN_SIZE = 56 écrit en dur, `lonLatToDemPixel` plaçait un point excentré à
// TROIS FOIS sa distance au centre en pixels — hors grille dès le premier tiers,
// donc un masque vide et une découpe qui « ne marche pas » sans erreur visible.
// Le seul témoin qui ne peut pas mentir : l'aller-retour.
test('l’aller-retour tient aussi sur une emprise 3×3', () => {
  const size = 128
  const dem = makeDem(new Float32Array(size * size), size)
  // ce que dem-emprise.js produit : même metersPerPixel, size et extentMeters
  // triplés, et l'origine reculée d'une tuile-bloc dans les deux sens
  const emprise = {
    ...dem,
    size: size * 3,
    empriseCote: 3,
    extentMeters: dem.extentMeters * 3,
    originTileX: dem.originTileX - 1,
    originTileY: dem.originTileY - 1,
  }
  for (const [px, py] of [[0, 0], [191, 191], [383, 383], [30, 300]]) {
    const [lon, lat] = demPixelToLonLat(emprise, px, py)
    const back = lonLatToDemPixel(emprise, lat, lon)
    assert.ok(Math.abs(back.x - px) < 1e-6, `x ${back.x} ≠ ${px}`)
    assert.ok(Math.abs(back.y - py) < 1e-6, `y ${back.y} ≠ ${py}`)
  }
})

// ---------------------------------------------------------------- peakMask

test('peakMask découpe le sommet visé et LUI SEUL', () => {
  const size = 200
  const f = maxOf(coneField(size, 70, 100, 40, 1000), coneField(size, 130, 100, 40, 900))
  const dem = makeDem(f, size)
  const [lon, lat] = demPixelToLonLat(dem, 70, 100)

  const out = peakMask(dem, { lat, lon, name: 'Cône Ouest' })
  assert.ok(out, 'un résultat attendu')
  assert.equal(out.loops >= 2, true, `plusieurs boucles avant filtrage (${out.loops})`)
  assert.equal(out.parts.length, 1, 'un seul polygone après filtrage')
  assert.equal(out.parts[0].length, 1, 'un seul anneau, pas de trou')

  // le voisin ne doit pas être dans la découpe
  const xs = out.ring.map((p) => p[0])
  assert.ok(Math.max(...xs) < 120, `la découpe déborde sur le voisin (maxX ${Math.max(...xs)})`)
  assert.ok(Math.min(...xs) > 20, `et ne doit pas non plus tout avaler (minX ${Math.min(...xs)})`)
})

test('peakMask rend null sur un plateau (aucun relief à découper)', () => {
  const size = 64
  const dem = makeDem(new Float32Array(size * size).fill(500), size)
  const [lon, lat] = demPixelToLonLat(dem, 32, 32)
  assert.equal(peakMask(dem, { lat, lon }), null)
})

test('peakMask rend null si le sommet n’est pas sur la dalle', () => {
  const size = 64
  const dem = makeDem(coneField(size, 32, 32, 20, 1000), size)
  assert.equal(peakMask(dem, { lat: 0, lon: 0 }), null)
})

// Sommet COLLÉ au bord : même la calotte la plus serrée sort du bloc, la garde
// de bord n'a plus de palier de repli. On rend quand même la découpe — tronquée
// mais fermée, donc remplissable — et on le DIT, à charge pour l'appelant de
// recharger une dalle recentrée avant d'afficher.
test('un sommet trop près du bord : découpe rendue, mais SIGNALÉE tronquée', () => {
  const size = 128
  const dem = makeDem(coneField(size, 2, 64, 50, 2000), size)
  const [lon, lat] = demPixelToLonLat(dem, 2, 64)
  const out = peakMask(dem, { lat, lon })
  assert.ok(out, 'on rend quand même quelque chose')
  assert.equal(out.clipped, true, 'la troncature doit être signalée à l’appelant')
  assert.deepEqual(out.ring[0], out.ring[out.ring.length - 1], 'la boucle reste fermée')
  assert.ok(Math.min(...out.ring.map((p) => p[0])) <= 0, 'la boucle longe le bord de la dalle')
})

// LE DÉNIVELÉ NE PEUT PAS ÊTRE UNE CONSTANTE EN MÈTRES. Le Mont Blanc culmine à
// 4808 m sur une vallée à ~1000, le Ventoux à 1909 sur une plaine à ~200 : le
// même retrait fixe rogne une calotte sur l'un et découpe tout le massif de
// l'autre. La règle est donc RELATIVE au relief local (sommet − bas de vallée).
test('le dénivelé suit le relief local, pas une constante en mètres', () => {
  const size = 120
  const blanc = makeDem(coneField(size, 60, 60, 40, 4808, 1000), size)
  const ventoux = makeDem(coneField(size, 60, 60, 40, 1909, 200), size)
  const [lo1, la1] = demPixelToLonLat(blanc, 60, 60)
  const [lo2, la2] = demPixelToLonLat(ventoux, 60, 60)

  const a = peakMask(blanc, { lat: la1, lon: lo1 })
  const b = peakMask(ventoux, { lat: la2, lon: lo2 })
  const rayon = (o) => Math.sqrt(ringArea(o.ring) / Math.PI)
  const ra = rayon(a)
  const rb = rayon(b)
  assert.ok(Math.abs(ra - rb) / ra < 0.12, `emprises comparables attendues : ${ra.toFixed(1)} vs ${rb.toFixed(1)}`)

  // …alors qu'un retrait FIXE de 1000 m donne deux emprises sans rapport
  const fa = Math.sqrt(ringArea(peakMask(blanc, { lat: la1, lon: lo1 }, { drop: 1000 }).ring) / Math.PI)
  const fb = Math.sqrt(ringArea(peakMask(ventoux, { lat: la2, lon: lo2 }, { drop: 1000 }).ring) / Math.PI)
  assert.ok(fb / fa > 1.8, `le retrait fixe devrait tout déséquilibrer : ${fa.toFixed(1)} vs ${fb.toFixed(1)}`)
})

test('la garde de fusion arrête la descente avant d’avaler le voisin', () => {
  const size = 200
  const f = maxOf(coneField(size, 70, 100, 40, 1000), coneField(size, 130, 100, 40, 900))
  const dem = makeDem(f, size)
  const [lon, lat] = demPixelToLonLat(dem, 70, 100)
  // sans garde, une descente jusqu'à 95 % du relief passe sous le col (~237 m)
  const sans = peakMask(dem, { lat, lon }, { dropRatio: 0.95, mergeFactor: null })
  assert.ok(Math.max(...sans.ring.map((p) => p[0])) > 125, 'sans garde, le voisin est avalé')
  const avec = peakMask(dem, { lat, lon }, { dropRatio: 0.95, mergeFactor: 1.6 })
  assert.equal(avec.merged, true, 'la fusion doit être détectée')
  assert.ok(Math.max(...avec.ring.map((p) => p[0])) < 120, 'et la découpe s’arrêter avant')
})

test('la garde de bord arrête la descente avant de sortir de la dalle', () => {
  const size = 128
  const dem = makeDem(coneField(size, 30, 64, 60, 2000), size)
  const [lon, lat] = demPixelToLonLat(dem, 30, 64)
  const out = peakMask(dem, { lat, lon }, { dropRatio: 0.9 })
  assert.equal(out.clipped, false, 'on remonte au dernier niveau qui tient dans la dalle')
})

// ---------------------------------------------------------------- contrat de sortie
// `parts` doit passer TELLE QUELLE dans region-mask.js. On ne l'affirme pas :
// on appelle frameRegion pour de vrai, et on fait consommer les coordonnées par
// rasterizeMask via un canevas bouchon.

test('parts passe dans frameRegion et cadre bien le sommet', () => {
  const size = 200
  const f = coneField(size, 100, 100, 40, 3000, 500)
  const dem = makeDem(f, size)
  const [lon, lat] = demPixelToLonLat(dem, 100, 100)
  const out = peakMask(dem, { lat, lon })

  const frame = frameRegion(out.parts)
  assert.ok(frame, 'frameRegion doit accepter parts sans conversion')
  assert.ok(Number.isFinite(frame.lat) && Number.isFinite(frame.lon) && Number.isFinite(frame.zoom))
  assert.ok(Math.abs(frame.lat - lat) < 0.02, `recentré sur le sommet : ${frame.lat} vs ${lat}`)
  assert.ok(Math.abs(frame.lon - lon) < 0.02)
  assert.ok(frame.zoom > dem.zoom, 'une découpe plus petite que la dalle doit resserrer le zoom')
})

test('parts est bien un MultiPolygon [polygone][anneau][lon,lat]', () => {
  const size = 96
  const dem = makeDem(coneField(size, 48, 48, 30, 2500, 300), size)
  const [lon, lat] = demPixelToLonLat(dem, 48, 48)
  const { parts, ring } = peakMask(dem, { lat, lon })
  assert.ok(Array.isArray(parts) && Array.isArray(parts[0]) && Array.isArray(parts[0][0]))
  const anneau = parts[0][0]
  assert.equal(anneau.length, ring.length)
  for (const p of anneau) {
    assert.equal(p.length, 2)
    assert.ok(Number.isFinite(p[0]) && Math.abs(p[0]) <= 180, `lon ${p[0]}`)
    assert.ok(Number.isFinite(p[1]) && Math.abs(p[1]) <= 85.1, `lat ${p[1]}`)
  }
})

test('rasterizeMask consomme parts sans broncher', async () => {
  const size = 96
  const dem = makeDem(coneField(size, 48, 48, 30, 2500, 300), size)
  const [lon, lat] = demPixelToLonLat(dem, 48, 48)
  const { parts } = peakMask(dem, { lat, lon })

  // canevas bouchon : on compte les points effectivement tracés
  let points = 0
  const ctx = (w) => ({
    fillStyle: '', filter: '',
    fillRect() {}, beginPath() {}, closePath() {}, fill() {}, drawImage() {},
    moveTo() { points++ }, lineTo() { points++ },
    getImageData: (x, y, sw, sh) => ({ width: sw, height: sh, data: new Uint8ClampedArray(sw * sh * 4) }),
    putImageData() {},
  })
  const prev = globalThis.document
  globalThis.document = { createElement: () => ({ width: 0, height: 0, getContext: ctx }) }
  try {
    const { rasterizeMask } = await import('../src/region-mask.js')
    const out = rasterizeMask(parts, dem, 256)
    assert.ok(out.texture && out.canvas)
    assert.equal(points, parts[0][0].length, 'tous les points de l’anneau ont été tracés')
  } finally {
    globalThis.document = prev
  }
})

// ---------------------------------------------------------------- recherche du sommet
// Nominatim classe « Mont Blanc » en tourism=viewpoint, avec la municipalité
// québécoise en second. Overpass sait demander UNIQUEMENT des natural=peak, et
// rend le tag `ele` — c'est lui qui départage.

test('la requête Overpass ne demande que des sommets nommés', () => {
  const q = overpassPeakQuery('Mont Blanc')
  assert.match(q, /\[out:json\]/)
  assert.match(q, /node\["natural"="peak"\]/)
  assert.match(q, /\["name"="Mont Blanc"\]/)
  assert.match(q, /out body \d+;/)
})

// MESURÉ EN DIRECT : `["name"="Mont Blanc"]` seul rend 12 sommets — un au
// Texas, plusieurs en Picardie, un au Québec — et PAS le vrai, dont le nom OSM
// est « Mont Blanc / Monte Bianco » (sommet frontalier, nom bilingue). Il n'est
// atteignable que par name:fr / alt_name. D'où l'union sur les clés de nom.
test('la requête exacte interroge toutes les clés de nom, pas seulement `name`', () => {
  const q = overpassPeakQuery('Mont Blanc')
  for (const k of ['name', 'name:fr', 'name:en', 'alt_name']) {
    assert.ok(q.includes(`["${k}"="Mont Blanc"]`), `clé ${k} absente : ${q}`)
  }
  assert.match(q, /^\[out:json\]\[timeout:\d+\];\(/, 'les clauses doivent former une union')
})

test('la requête large est une regex insensible à la casse, métacaractères échappés', () => {
  const q = overpassPeakQuery('Pic d.Aneto (3404)', { exact: false, bboxes: [{ s: 42, w: 0, n: 43, e: 1 }] })
  assert.match(q, /\["name"~/)
  assert.match(q, /,i\]/)
  assert.ok(q.includes('\\(3404\\)'), `parenthèses non échappées : ${q}`)
  assert.ok(q.includes('d\\.Aneto'), `point non échappé : ${q}`)
})

// La regex GLOBALE sur tous les sommets du monde a été mesurée : 504 après 43 s.
// Elle n'est utilisable que BORNÉE par une emprise.
test('une emprise borne la requête, et il peut y en avoir plusieurs', () => {
  const q = overpassPeakQuery('Ventoux', {
    exact: false,
    bboxes: [{ s: 44, w: 5, n: 44.5, e: 5.5 }, { s: 48, w: 2, n: 48.5, e: 2.5 }],
  })
  assert.ok(q.includes('(44,5,44.5,5.5)'), q)
  assert.ok(q.includes('(48,2,48.5,2.5)'), q)
  assert.equal((q.match(/node\["natural"="peak"\]/g) || []).length, 2)
})

test('les guillemets d’un nom ne peuvent pas casser la requête', () => {
  const q = overpassPeakQuery('Le "Grand" Pic')
  assert.ok(!/[^\\]"Grand"/.test(q), `guillemets non échappés : ${q}`)
})

// LE CLASSEMENT. « Mont Blanc » existe aussi au Québec (~968 m, station de ski).
// Les deux sont natural=peak, les deux portent exactement le même nom : c'est
// l'ALTITUDE qui tranche, pas l'ordre rendu par le serveur.
test('le vrai Mont Blanc sort avant le Mont-Blanc du Québec', () => {
  const elements = [
    { type: 'node', lat: 46.19, lon: -74.6, tags: { natural: 'peak', name: 'Mont Blanc', ele: '968' } },
    { type: 'node', lat: 45.8326, lon: 6.8652, tags: { natural: 'peak', name: 'Mont Blanc', ele: '4808', wikidata: 'Q583' } },
  ]
  const r = rankPeakCandidates(elements, 'Mont Blanc')
  assert.equal(r.length, 2)
  assert.equal(r[0].ele, 4808)
  assert.ok(Math.abs(r[0].lat - 45.8326) < 1e-6)
})

// RÉGRESSION MESURÉE SUR LA VRAIE BASE OSM. Le sommet du Mont Blanc est
// frontalier : son `name` est « Mont Blanc / Monte Bianco ». Comparé au seul
// `name` brut, il ne comptait que comme correspondance PARTIELLE, et le
// « Mont Blanc » de Matane (1063 m, Québec) — exact, lui — passait devant.
// Le score doit donc se faire sur TOUTES les variantes du nom, nom bilingue
// découpé compris.
test('un sommet frontalier au nom bilingue reste une correspondance EXACTE', () => {
  const elements = [
    { type: 'node', lat: 48.7761, lon: -66.8818, tags: { natural: 'peak', name: 'Mont Blanc', ele: '1063' } },
    { type: 'node', lat: 46.1023, lon: -74.4836, tags: { natural: 'peak', name: 'Mont Blanc', ele: '540' } },
    {
      type: 'node',
      lat: 45.8327,
      lon: 6.8652,
      tags: { natural: 'peak', name: 'Mont Blanc / Monte Bianco', 'name:fr': 'Mont Blanc', ele: '4807.3' },
    },
  ]
  const r = rankPeakCandidates(elements, 'Mont Blanc')
  assert.equal(r[0].ele, 4807.3, `le vrai Mont Blanc doit sortir premier, obtenu ${r[0].name} ${r[0].ele}`)
  assert.equal(r[0].exact, 2, 'et compter comme correspondance exacte')
})

test('le nom bilingue suffit même sans name:fr (découpe sur le séparateur)', () => {
  const elements = [
    { type: 'node', lat: 1, lon: 1, tags: { natural: 'peak', name: 'Mont Blanc', ele: '1063' } },
    { type: 'node', lat: 2, lon: 2, tags: { natural: 'peak', name: 'Mont Blanc / Monte Bianco', ele: '4807.3' } },
  ]
  assert.equal(rankPeakCandidates(elements, 'Mont Blanc')[0].ele, 4807.3)
})

test('le nom EXACT passe devant un nom simplement plus haut', () => {
  const elements = [
    { type: 'node', lat: 27.98, lon: 86.92, tags: { natural: 'peak', name: 'Everest', ele: '8849' } },
    { type: 'node', lat: 44.17, lon: 5.27, tags: { natural: 'peak', name: 'Mont Ventoux', ele: '1909' } },
  ]
  const r = rankPeakCandidates(elements, 'Ventoux')
  assert.equal(r[0].name, 'Mont Ventoux', 'un nom sans rapport ne doit pas remonter')
  assert.equal(r.length, 1)
})

test('tirets, accents et casse ne changent pas le classement', () => {
  const elements = [
    { type: 'node', lat: 1, lon: 1, tags: { natural: 'peak', name: 'Mont-Blanc', ele: '968' } },
    { type: 'node', lat: 2, lon: 2, tags: { natural: 'peak', name: 'MONT BLANC', ele: '4808' } },
  ]
  const r = rankPeakCandidates(elements, 'mont blanc')
  assert.equal(r.length, 2, 'les deux sont des correspondances exactes')
  assert.equal(r[0].ele, 4808)
})

test('un sommet sans ele reste candidat, mais derrière ceux qui en ont un', () => {
  const elements = [
    { type: 'node', lat: 1, lon: 1, tags: { natural: 'peak', name: 'Truc' } },
    { type: 'node', lat: 2, lon: 2, tags: { natural: 'peak', name: 'Truc', ele: '1200' } },
  ]
  const r = rankPeakCandidates(elements, 'Truc')
  assert.equal(r[0].ele, 1200)
  assert.equal(r[1].ele, null)
})

test('ce qui n’est pas un sommet est écarté (le viewpoint de Nominatim)', () => {
  const elements = [
    { type: 'node', lat: 1, lon: 1, tags: { tourism: 'viewpoint', name: 'Mont Blanc' } },
    { type: 'node', lat: 2, lon: 2, tags: { place: 'village', name: 'Mont-Blanc' } },
  ]
  assert.deepEqual(rankPeakCandidates(elements, 'Mont Blanc'), [])
})

// LE REPLI À DEUX ÉTAGES. « Ventoux » n'est le nom exact d'AUCUN sommet
// (mesuré : 0 résultat sur les six clés de nom), et la regex globale sur tous
// les sommets du monde répond 504 en 43 s. Nominatim, lui, sait rapprocher
// « Ventoux » de communes qui l'entourent — mais il ne rend ni le type ni
// l'altitude. On les combine : Nominatim LOCALISE, Overpass QUALIFIE, la regex
// n'étant plus lancée que dans une emprise bornée (mesuré : 4,6 s).
test('findPeak : Nominatim localise, Overpass qualifie, quand le nom exact ne rend rien', async () => {
  const vues = []
  const fakeFetch = async (url, init) => {
    vues.push(String(url))
    if (String(url).includes('nominatim')) {
      // ce que rend vraiment Nominatim pour « Ventoux » : des communes, dont
      // une à côté de Paris en TÊTE — le classement est un piège, ici encore
      return {
        ok: true,
        json: async () => [
          { lat: '48.6778', lon: '2.1769' },
          { lat: '44.2120', lon: '5.2758' },
        ],
      }
    }
    const body = decodeURIComponent(String(init.body).replace(/^data=/, ''))
    const elements = /~/.test(body)
      ? [{ type: 'node', lat: 44.174, lon: 5.2784, tags: { natural: 'peak', name: 'Mont Ventoux', ele: '1910' } }]
      : []
    return { ok: true, json: async () => ({ elements }) }
  }
  const p = await findPeak('Ventoux', { fetchImpl: fakeFetch })
  assert.equal(p.name, 'Mont Ventoux')
  assert.equal(p.ele, 1910)
  assert.equal(vues.length, 3, 'overpass exact, nominatim, overpass borné')
  assert.ok(vues[1].includes('nominatim'), `2ᵉ appel : ${vues[1]}`)
})

test('findPeak ne lance jamais la regex sans emprise (mesuré : 504 en 43 s)', async () => {
  const bodies = []
  const fakeFetch = async (url, init) => {
    if (String(url).includes('nominatim')) return { ok: true, json: async () => [] }
    bodies.push(decodeURIComponent(String(init.body).replace(/^data=/, '')))
    return { ok: true, json: async () => ({ elements: [] }) }
  }
  assert.equal(await findPeak('Ventoux', { fetchImpl: fakeFetch }), null)
  for (const b of bodies) {
    if (/~/.test(b)) assert.match(b, /\(-?\d[\d.]*,-?\d[\d.]*,-?\d[\d.]*,-?\d[\d.]*\)/, `regex sans emprise : ${b}`)
  }
})

test('findPeak ne lance pas de seconde requête si la première suffit', async () => {
  let n = 0
  const fakeFetch = async () => {
    n++
    return {
      ok: true,
      json: async () => ({
        elements: [{ type: 'node', lat: 45.83, lon: 6.86, tags: { natural: 'peak', name: 'Mont Blanc', ele: '4808' } }],
      }),
    }
  }
  const p = await findPeak('Mont Blanc', { fetchImpl: fakeFetch })
  assert.equal(n, 1)
  assert.equal(p.ele, 4808)
})

// LE REPLI DOIT SURVIVRE À LA PANNE DE L'ÉTAGE QU'IL REMPLACE. Overpass rend
// régulièrement 429/504 (mesuré le même jour sur quatre miroirs, dont un 504
// après 31 s sur la requête « Mont Blanc » qui avait rendu 14 éléments en 1,3 s
// une minute plus tôt). Tant que l'échec de l'étage 1 sortait de la fonction, il
// emportait l'étage 2 avec lui — celui-là même qui existe pour ça : « Mont
// Blanc » rendait null en 8,9 s et retombait sur la Haute-Savoie, alors que
// Nominatim + regex bornée le résolvent en 3,4 s (« Mont Blanc / Monte
// Bianco », 4807,3 m — mesuré). « Ventoux » masquait la panne : son étage 1
// répond 200 avec zéro correspondance, donc sans jamais jeter.
test('un hoquet d’Overpass à l’étage 1 n’emporte pas le repli', async () => {
  const vues = []
  const fakeFetch = async (url, init) => {
    vues.push(String(url))
    if (String(url).includes('nominatim')) return { ok: true, json: async () => [{ lat: '45.8327', lon: '6.8652' }] }
    // 1ʳᵉ requête Overpass : la panne. Overpass sert alors une page d'erreur
    // XML, que `.json()` ne sait pas lire — d'où le json() qui jette aussi.
    if (vues.filter((u) => !u.includes('nominatim')).length === 1) {
      return { ok: false, status: 504, json: async () => { throw new Error('Unexpected token <') } }
    }
    return {
      ok: true,
      json: async () => ({
        elements: [
          { type: 'node', id: 1, lat: 45.8326, lon: 6.8652, tags: { natural: 'peak', name: 'Mont Blanc / Monte Bianco', 'name:fr': 'Mont Blanc', ele: '4807.3' } },
        ],
      }),
    }
  }
  const p = await findPeak('Mont Blanc', { fetchImpl: fakeFetch })
  assert.ok(p, 'l’étage 2 doit rattraper la panne de l’étage 1')
  assert.equal(p.ele, 4807.3)
  assert.equal(vues.length, 3, `overpass en panne, nominatim, overpass borné — vu : ${vues.length}`)
  assert.ok(vues[1].includes('nominatim'), `2ᵉ appel : ${vues[1]}`)
})

// La panne de Nominatim ne doit pas davantage jeter : sans emprise, il n'y a
// simplement plus rien à tenter (la regex globale expire, voir l'entête).
test('findPeak rend null, sans jeter, quand les deux étages tombent', async () => {
  const ko = async (url) => (String(url).includes('nominatim')
    ? { ok: false, status: 429, json: async () => ({}) }
    : { ok: false, status: 504, json: async () => ({}) })
  assert.equal(await findPeak('Mont Blanc', { fetchImpl: ko }), null)
})

test('findPeak rend null au lieu de jeter quand Overpass tombe', async () => {
  const ko = async () => ({ ok: false, status: 504, json: async () => ({}) })
  assert.equal(await findPeak('Mont Blanc', { fetchImpl: ko }), null)
  const boom = async () => { throw new Error('réseau') }
  assert.equal(await findPeak('Mont Blanc', { fetchImpl: boom }), null)
  assert.equal(await findPeak('   ', { fetchImpl: boom }), null)
})
