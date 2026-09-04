// B6 — QUEL ANCÊTRE BATHY SERT CHAQUE TUILE, sur une large fenêtre d'océan.
//
// Ne charge PAS le terrarium : on n'appelle que `peindreBathyTuile`, deux fois,
// exactement comme `fondMarinTuile` — d'abord au plancher normal (BATHY_ZMIN),
// puis au plancher d'index quand le terrarium est muet (c'est le cas partout en
// pleine mer profonde : mesuré 262 144 / 262 144 pixels à 0,000 pile).
//
//   node scripts/b6-ancetres.mjs --port 9317 --lieu -19.7253,63.3691 --z 10 --rayon 6
import fs from 'node:fs'
import path from 'node:path'
import { fileURLToPath } from 'node:url'
const RACINE = path.dirname(path.dirname(fileURLToPath(import.meta.url)))
const A = process.argv.slice(2)
const opt = (n, d) => { const i = A.indexOf(n); return i >= 0 && A[i + 1] !== undefined ? A[i + 1] : d }
const PORT = Number(opt('--port', '9317'))
const [LAT, LON] = opt('--lieu', '-19.7253,63.3691').split(',').map(Number)
const NOM = opt('--nom', 'rodrigues')
const ZS = opt('--z', '9,10,11').split(',').map(Number)
const RAYON = Number(opt('--rayon', '6'))
const ICI = path.join(RACINE, '.banc', 'B6')
fs.mkdirSync(ICI, { recursive: true })
fs.writeFileSync(path.join(RACINE, 'banc-vide.html'), '<!doctype html><meta charset=utf-8><title>banc</title><body>banc')
const pup = (await import('file:///C:/Dev/wt-f3/node_modules/puppeteer-core/lib/puppeteer/puppeteer-core.js')).default
const nav = await pup.launch({ executablePath: 'C:/Program Files/Google/Chrome/Application/chrome.exe', headless: 'new', args: ['--use-angle=default'], defaultViewport: { width: 900, height: 600 } })
const page = (await nav.pages())[0]
await page.goto(`http://127.0.0.1:${PORT}/banc-vide.html`, { waitUntil: 'domcontentloaded', timeout: 120000 })

const R = await page.evaluate(async (lat, lon, zs, rayon) => {
  const { peindreBathyTuile, indexBathy } = await import('/src/dem.js')
  const index = await indexBathy()
  const latRad = (lat * Math.PI) / 180
  const res = []
  for (const z of zs) {
    const n = 2 ** z
    const cx = Math.floor(((lon + 180) / 360) * n)
    const cy = Math.floor(((1 - Math.log(Math.tan(latRad) + 1 / Math.cos(latRad)) / Math.PI) / 2) * n)
    const grille = []
    for (let dy = -rayon; dy <= rayon; dy++) {
      const ligne = []
      for (let dx = -rayon; dx <= rayon; dx++) {
        const tx = cx + dx, ty = cy + dy
        const dst = new Float32Array(64 * 64).fill(NaN)
        const arg = { zoom: z, tx, ty, index, dst, dstStride: 64, dx: 0, dy: 0, dw: 64, dh: 64 }
        let p1 = await peindreBathyTuile(arg)
        let p2 = p1
        if (p1 < 0) p2 = await peindreBathyTuile({ ...arg, plancher: index.zmin })
        // la profondeur MOYENNE réellement servie : c'est elle qui décide de la
        // couleur, et donc de la « plaque » qu'Adrien voit
        let som = 0, k = 0, mn = Infinity, mx = -Infinity
        for (const v of dst) { if (!Number.isFinite(v)) continue; som += v; k++; if (v < mn) mn = v; if (v > mx) mx = v }
        const moy = k ? som / k : NaN
        ligne.push({ tx, ty, normal: p1, muet: p2, moy })
        res.push({ z, tx, ty, normal: p1, muet: p2, moy: k ? +moy.toFixed(1) : null, min: k ? +mn.toFixed(1) : null, max: k ? +mx.toFixed(1) : null })
      }
      grille.push(ligne)
    }
    console.log(`z${z} centre ${cx}/${cy}`)
    console.log('  plancher NORMAL (BATHY_ZMIN=7) :')
    for (const l of grille) console.log('   ' + l.map((c) => (c.normal < 0 ? ' .' : String(c.normal).padStart(2))).join(' '))
    console.log('  plancher INDEX (terrarium muet) :')
    for (const l of grille) console.log('   ' + l.map((c) => (c.muet < 0 ? ' .' : String(c.muet).padStart(2))).join(' '))
  }
  return res
}, LAT, LON, ZS, RAYON)

for (const z of ZS) {
  const s = R.filter((r) => r.z === z)
  const c = (f) => s.filter(f).length
  console.log(`\nz${z} : ${s.length} tuiles · plancher normal : ${c((r) => r.normal < 0)} SANS bathy · plancher index : ${c((r) => r.muet < 0)} SANS bathy`)
  const par = new Map()
  for (const r of s) par.set(r.muet, (par.get(r.muet) ?? 0) + 1)
  console.log('  ancêtre servi (plancher index) : ' + [...par].sort((a, b) => b[0] - a[0]).map(([k, v]) => `z${k}=${v}`).join(' · '))
  console.log('  profondeur MOYENNE servie, par niveau d ancêtre (la « plaque » est un ÉCART DE COULEUR, donc de profondeur) :')
  for (const [k] of [...par].sort((a, b) => b[0] - a[0])) {
    const d = s.filter((r) => r.muet === k && r.moy != null).map((r) => r.moy)
    if (!d.length) continue
    const moy = d.reduce((a, b) => a + b, 0) / d.length
    console.log(`     ancêtre z${k} (${(156543.03392 * Math.cos(-19.7253 * Math.PI / 180) / 2 ** k).toFixed(0)} m/cellule) : ${d.length} tuiles · fond moyen ${moy.toFixed(0)} m · de ${Math.min(...d).toFixed(0)} à ${Math.max(...d).toFixed(0)} m`)
  }
}
fs.writeFileSync(path.join(ICI, `ancetres-${NOM}.json`), JSON.stringify(R, null, 2))
await nav.close()
