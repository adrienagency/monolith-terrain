// RELEVÉ BT-I — ce que NOS TUILES disent, lues sur le disque, sans navigateur.
//
// ⚠️ CE N'EST PAS LA MESURE DE RÉFÉRENCE. La mesure qui fait foi est celle du
// GPU (`readPixels` sur la texture GL), parce que `t.heights` est relâché dès le
// maillage bâti et qu'une lecture « côté code » ne voit pas ce que l'écran
// montre. Ce relevé sert à autre chose : il isole la DONNÉE de la CHAÎNE. Quand
// les deux disent la même chose, on sait que le défaut n'est pas dans les
// tuiles ; quand elles divergent, on sait qu'il y est.
//
// Les deux grandeurs sont celles du barème, et aucune n'est en mètres d'erreur :
//  · la PENTE PAR KILOMÈTRE — étendue de la fenêtre 9×9 ramenée au sol. Elle est
//    indépendante de la taille de tuile, ce qui a coûté un faux constat à B3
//    (256 px contre 512 : il a cru à ×1,7-2 de relief avant de comprendre qu'il
//    mesurait la tuile).
//  · le RAPPORT D'ÉTENDUE z12→z13. Une interpolation pure vaut exactement 0,500 :
//    c'est la signature d'une surface qui ne reçoit aucune donnée nouvelle.
//
//   node scripts/releve-bt-i.mjs

import fs from 'node:fs'
import zlib from 'node:zlib'

// PNG RVB8, filtres 0-4. Écrit à la main : le dépôt n'a ni sharp ni pngjs, et
// le tuileur écrit déjà son PNG à la main pour la même raison.
function litPng(p) {
  const b = fs.readFileSync(p)
  let o = 8
  let w = 0
  let h = 0
  const idat = []
  while (o < b.length) {
    const len = b.readUInt32BE(o)
    const t = b.toString('ascii', o + 4, o + 8)
    if (t === 'IHDR') {
      w = b.readUInt32BE(o + 8)
      h = b.readUInt32BE(o + 12)
    }
    if (t === 'IDAT') idat.push(b.subarray(o + 8, o + 8 + len))
    o += 12 + len
  }
  const raw = zlib.inflateSync(Buffer.concat(idat))
  const bpp = 3
  const stride = w * bpp
  const out = Buffer.alloc(h * stride)
  for (let y = 0; y < h; y++) {
    const f = raw[y * (stride + 1)]
    const line = raw.subarray(y * (stride + 1) + 1, (y + 1) * (stride + 1))
    for (let x = 0; x < stride; x++) {
      const a = x >= bpp ? out[y * stride + x - bpp] : 0
      const up = y > 0 ? out[(y - 1) * stride + x] : 0
      const ul = x >= bpp && y > 0 ? out[(y - 1) * stride + x - bpp] : 0
      let v = line[x]
      if (f === 1) v += a
      else if (f === 2) v += up
      else if (f === 3) v += (a + up) >> 1
      else if (f === 4) {
        const pp = a + up - ul
        const pa = Math.abs(pp - a)
        const pb = Math.abs(pp - up)
        const pc = Math.abs(pp - ul)
        v += pa <= pb && pa <= pc ? a : pb <= pc ? up : ul
      }
      out[y * stride + x] = v & 255
    }
  }
  return { w, h, px: out }
}

const lon2x = (l, z) => ((l + 180) / 360) * 2 ** z
const lat2y = (l, z) => {
  const s = Math.sin((l * Math.PI) / 180)
  return (0.5 - Math.log((1 + s) / (1 - s)) / (4 * Math.PI)) * 2 ** z
}
// Côté d'un texel AU SOL, en mètres — la grandeur qui rend deux fenêtres
// comparables quand les tuiles n'ont pas la même taille en pixels.
const texelM = (z, px, lat) => (40075017 * Math.cos((lat * Math.PI) / 180)) / (2 ** z * px)

function fenetre(z, lat, lon, racine = 'public/data/bathy') {
  const X = lon2x(lon, z)
  const Y = lat2y(lat, z)
  const tx = Math.floor(X)
  const ty = Math.floor(Y)
  const p = `${racine}/${z}/${tx}/${ty}.png`
  if (!fs.existsSync(p)) return null
  const im = litPng(p)
  const col = Math.min(im.w - 1, Math.floor((X - tx) * im.w))
  const row = Math.min(im.h - 1, Math.floor((Y - ty) * im.h))
  const v = []
  for (let dy = -4; dy <= 4; dy++)
    for (let dx = -4; dx <= 4; dx++) {
      const x = Math.min(im.w - 1, Math.max(0, col + dx))
      const y = Math.min(im.h - 1, Math.max(0, row + dy))
      const o = (y * im.w + x) * 3
      v.push(im.px[o] * 256 + im.px[o + 1] + im.px[o + 2] / 256 - 32768)
    }
  const mn = Math.min(...v)
  const mx = Math.max(...v)
  const etendue = mx - mn
  return {
    z,
    px: im.w,
    centre: v[40],
    etendue,
    penteKm: (etendue / (9 * texelM(z, im.w, lat))) * 1000,
  }
}

const POINTS = [
  ['Chesapeake — embouchure', 37.0, -76.05],
  ['Chesapeake — bassin médian', 38.2, -76.3],
  ['Virginia Beach', 36.8, -75.3],
  ['New York Bight', 40.5, -73.9],
  ['Georges Bank', 41.3, -67.5],
  ['Plateau louisianais', 28.8, -90.5],
  ['Plateau ouest-Floride', 27.5, -83.2],
  ['Puget Sound', 47.6, -122.45],
  ['Lac Érié', 42.0, -81.5],
  ['Lac Michigan', 43.3, -86.9],
  ['TÉMOIN Manche', 50.0, -1.5],
  ['TÉMOIN Léman', 46.44064, 6.59996],
]

console.log('\n  lieu                          z11 fond / pente     z12 fond / pente     z13 fond / pente    rapport z12→z13')
console.log('  ' + '─'.repeat(112))
for (const [nom, lat, lon] of POINTS) {
  const f = {}
  for (const z of [11, 12, 13]) f[z] = fenetre(z, lat, lon)
  const c = (x) =>
    x ? `${x.centre.toFixed(2).padStart(9)} /${x.penteKm.toFixed(2).padStart(7)}` : '        —        '
  const r = f[12] && f[13] && f[12].etendue > 0 ? (f[13].etendue / f[12].etendue).toFixed(3) : '—'
  const degel = f[11] && f[13] ? Math.abs(f[13].centre - f[11].centre).toFixed(2) : '—'
  console.log(
    `  ${nom.padEnd(28)} ${c(f[11])}  ${c(f[12])}  ${c(f[13])}    ${String(r).padStart(6)}   (z11→z13 : ${degel} m)`,
  )
}
console.log(
  '\n  « fond » = mètres au centre de la fenêtre · « pente » = m/km · rapport 0,500 = interpolation pure, sans donnée nouvelle\n',
)
