// B6 — LE STRIAGE : est-il DANS LA DONNÉE, ou fabriqué par le rééchantillonnage ?
//
// Trois mesures sur la MÊME tuile bathy, en pleine mer profonde :
//   ① la tuile BRUTE décodée (256², telle que le fichier .webp la porte) ;
//   ② la même passée par `resampleCatmullRom` au facteur du surzoom réel ;
//   ③ le pas de quantification effectif (plus petit écart non nul entre valeurs
//      voisines distinctes) — c'est le « bruit d'encodage » du critère.
//
// Le striage se chiffre en PIC-À-PIC entre bandes voisines : on projette le
// champ sur chaque axe (moyenne par colonne, moyenne par ligne), on retire une
// tendance lissée sur 9, et on prend l'amplitude du résidu. Une bande régulière
// survit à la moyenne de 256 lignes ; un relief réel non.
//
//   node scripts/b6-striage.mjs --port 9317
import fs from 'node:fs'
import path from 'node:path'
import { fileURLToPath } from 'node:url'
const RACINE = path.dirname(path.dirname(fileURLToPath(import.meta.url)))
const A = process.argv.slice(2)
const opt = (n, d) => { const i = A.indexOf(n); return i >= 0 && A[i + 1] !== undefined ? A[i + 1] : d }
const PORT = Number(opt('--port', '9317'))
const ICI = path.join(RACINE, '.banc', 'B6')
fs.mkdirSync(ICI, { recursive: true })
fs.writeFileSync(path.join(RACINE, 'banc-vide.html'), '<!doctype html><meta charset=utf-8><title>banc</title><body>banc')
const pup = (await import('file:///C:/Dev/wt-f3/node_modules/puppeteer-core/lib/puppeteer/puppeteer-core.js')).default
const nav = await pup.launch({ executablePath: 'C:/Program Files/Google/Chrome/Application/chrome.exe', headless: 'new', args: ['--use-angle=default'], defaultViewport: { width: 900, height: 600 } })
const page = (await nav.pages())[0]
page.on('console', (m) => { if (m.type() === 'error') console.log('  [page]', m.text()) })
await page.goto(`http://127.0.0.1:${PORT}/banc-vide.html`, { waitUntil: 'domcontentloaded', timeout: 120000 })

// tuiles choisies : autour de Rodrigues (z8 servi), et un témoin au large
const TUILES = JSON.parse(opt('--tuiles', JSON.stringify([
  { nom: 'rodrigues z8 173/142', z: 8, x: 173, y: 142 },
  { nom: 'rodrigues z8 172/142', z: 8, x: 172, y: 142 },
  { nom: 'rodrigues z6 43/35', z: 6, x: 43, y: 35 },
  { nom: 'rodrigues z4 10/8', z: 4, x: 10, y: 8 },
  { nom: 'reunion z6 41/36', z: 6, x: 41, y: 36 },
])))

const R = await page.evaluate(async (tuiles) => {
  const { resampleCatmullRom } = await import('/src/bathy.js')
  const out = []
  // profil : moyenne par colonne (axe X) et par ligne (axe Y), résidu au lissé 9
  const profil = (m, w, h) => {
    const col = new Float64Array(w), lig = new Float64Array(h)
    for (let y = 0; y < h; y++) for (let x = 0; x < w; x++) { const v = m[y * w + x]; col[x] += v / h; lig[y] += v / w }
    const resid = (a) => {
      const n = a.length, r = new Float64Array(n)
      for (let i = 0; i < n; i++) {
        let s = 0, k = 0
        for (let j = i - 4; j <= i + 4; j++) { if (j < 0 || j >= n) continue; s += a[j]; k++ }
        r[i] = a[i] - s / k
      }
      // pic-à-pic du résidu, en écartant les 2 % extrêmes
      const b = Array.from(r).sort((u, v) => u - v)
      return { pp: b[Math.floor(0.99 * n)] - b[Math.floor(0.01 * n)], ecart: Math.sqrt(r.reduce((s2, v) => s2 + v * v, 0) / n) }
    }
    return { x: resid(col), y: resid(lig) }
  }
  for (const t of tuiles) {
    const url = `/data/bathy/${t.z}/${t.x}/${t.y}.png`
    const r = await fetch(url)
    const ct = r.headers.get('content-type') || ''
    if (!r.ok || !ct.startsWith('image/')) { out.push({ ...t, erreur: `HTTP ${r.status} ${ct}` }); continue }
    const img = await createImageBitmap(await r.blob(), { colorSpaceConversion: "none" })
    const W = img.width, H = img.height
    const c = document.createElement('canvas'); c.width = W; c.height = H
    const g = c.getContext('2d', { willReadFrequently: true })
    g.drawImage(img, 0, 0)
    const p = g.getImageData(0, 0, W, H).data
    const m = new Float32Array(W * H)
    for (let i = 0; i < W * H; i++) m[i] = p[i * 4] * 256 + p[i * 4 + 1] + p[i * 4 + 2] / 256 - 32768
    // ③ pas de quantification : plus petit écart NON NUL entre valeurs distinctes
    const vals = [...new Set(Array.from(m))].sort((a, b) => a - b)
    let pas = Infinity
    for (let i = 1; i < vals.length; i++) { const d = vals[i] - vals[i - 1]; if (d > 1e-6 && d < pas) pas = d }
    let mn = Infinity, mx = -Infinity
    for (const v of m) { if (v < mn) mn = v; if (v > mx) mx = v }
    const brut = profil(m, W, H)
    // ② rééchantillonné comme le fait `peindreBathyTuile` à un surzoom de 4×
    //    (une tuile z9 servie par un ancêtre z7, cas courant ici) puis 32× (z4)
    const rees = {}
    for (const scale of [1, 4, 32]) {
      const dst = new Float32Array(256 * 256)
      resampleCatmullRom({ src: m, srcW: W, srcH: H, sx: 0, sy: 0, sw: W / scale, sh: H / scale, dst, dstStride: 256, dx: 0, dy: 0, dw: 256, dh: 256 })
      rees[scale] = profil(dst, 256, 256)
    }
    out.push({
      ...t, W, H, valeursDistinctes: vals.length, pasQuant: +pas.toFixed(4),
      min: +mn.toFixed(1), max: +mx.toFixed(1),
      brutXpp: +brut.x.pp.toFixed(2), brutYpp: +brut.y.pp.toFixed(2),
      brutXsd: +brut.x.ecart.toFixed(2), brutYsd: +brut.y.ecart.toFixed(2),
      r1Xpp: +rees[1].x.pp.toFixed(2), r1Ypp: +rees[1].y.pp.toFixed(2),
      r4Xpp: +rees[4].x.pp.toFixed(2), r4Ypp: +rees[4].y.pp.toFixed(2),
      r32Xpp: +rees[32].x.pp.toFixed(2), r32Ypp: +rees[32].y.pp.toFixed(2),
    })
  }
  return out
}, TUILES)

console.log('\n  tuile                      px   valeurs  pas m    min/max        BRUT pic-à-pic X/Y   sd X/Y   |  rééch ×1 X/Y   ×4 X/Y     ×32 X/Y')
for (const r of R) {
  if (r.erreur) { console.log(`  ${r.nom.padEnd(24)} ⚠ ${r.erreur}`); continue }
  console.log(`  ${r.nom.padEnd(24)} ${String(r.W).padStart(4)} ${String(r.valeursDistinctes).padStart(8)} ${String(r.pasQuant).padStart(6)} ${String(r.min).padStart(8)}/${String(r.max).padStart(8)}   ${String(r.brutXpp).padStart(7)}/${String(r.brutYpp).padStart(7)} ${String(r.brutXsd).padStart(6)}/${String(r.brutYsd).padStart(6)}  | ${String(r.r1Xpp).padStart(6)}/${String(r.r1Ypp).padStart(6)} ${String(r.r4Xpp).padStart(6)}/${String(r.r4Ypp).padStart(6)} ${String(r.r32Xpp).padStart(6)}/${String(r.r32Ypp).padStart(6)}`)
}
fs.writeFileSync(path.join(ICI, 'striage.json'), JSON.stringify(R, null, 2))
await nav.close()
