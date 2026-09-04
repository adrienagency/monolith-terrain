// B6 — LES MARCHES AUX COUTURES DE TUILES : la plaque rectangulaire, chiffrée.
//
// On peint une bande CONTIGUË de tuiles bathy (exactement comme
// `loadBathyPatch` / `demanderBathy` remplissent leur nappe), puis on compare :
//   · l'écart moyen |Δ| entre deux colonnes voisines À L'INTÉRIEUR d'une tuile,
//   · l'écart moyen |Δ| entre les deux colonnes qui se font face À LA COUTURE.
// Une couture invisible donne le même chiffre des deux côtés. Une plaque à
// arête rectiligne donne une MARCHE : c'est elle qu'Adrien filme.
//
// Deux variantes de peinture, sur les MÊMES tuiles :
//   normal  = le plancher `BATHY_ZMIN` (ce que fait `demanderBathy` aujourd'hui)
//   index   = le plancher d'index (ce que font `fondMarinTuile` et
//             `loadBathyPatch` quand le terrarium est muet)
//
//   node scripts/b6-marches.mjs --port 9317 --z 9 --lieu -19.7253,63.3691
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
const LARGEUR = Number(opt('--largeur', '7')) // tuiles de large, centrées sur le lieu
const ICI = path.join(RACINE, '.banc', 'B6')
fs.mkdirSync(ICI, { recursive: true })
fs.writeFileSync(path.join(RACINE, 'banc-vide.html'), '<!doctype html><meta charset=utf-8><title>banc</title><body>banc')
const pup = (await import('file:///C:/Dev/wt-f3/node_modules/puppeteer-core/lib/puppeteer/puppeteer-core.js')).default
const nav = await pup.launch({ executablePath: 'C:/Program Files/Google/Chrome/Application/chrome.exe', headless: 'new', args: ['--use-angle=default'], defaultViewport: { width: 900, height: 600 } })
const page = (await nav.pages())[0]
await page.goto(`http://127.0.0.1:${PORT}/banc-vide.html`, { waitUntil: 'domcontentloaded', timeout: 120000 })

const R = await page.evaluate(async (lat, lon, zs, larg) => {
  const { peindreBathyTuile, indexBathy } = await import('/src/dem.js')
  const index = await indexBathy()
  const latRad = (lat * Math.PI) / 180
  const PX = 256
  const out = []
  for (const z of zs) {
    const n = 2 ** z
    const cx = Math.floor(((lon + 180) / 360) * n)
    const cy = Math.floor(((1 - Math.log(Math.tan(latRad) + 1 / Math.cos(latRad)) / Math.PI) / 2) * n)
    const x0 = cx - (larg >> 1), y0 = cy - (larg >> 1)
    for (const mode of ['normal', 'index']) {
      const W = larg * PX, H = larg * PX
      const patch = new Float32Array(W * H).fill(NaN)
      const zs2 = []
      for (let j = 0; j < larg; j++) for (let i = 0; i < larg; i++) {
        const arg = { zoom: z, tx: x0 + i, ty: y0 + j, index, dst: patch, dstStride: W, dx: i * PX, dy: j * PX, dw: PX, dh: PX }
        let zt = await peindreBathyTuile(arg)
        if (zt < 0 && mode === 'index') zt = await peindreBathyTuile({ ...arg, plancher: index.zmin })
        zs2.push(zt)
      }
      // écarts horizontaux : à l'intérieur d'une tuile, et à la couture
      const acc = { dedansX: [], coutureX: [], dedansY: [], coutureY: [] }
      for (let y = 0; y < H; y++) for (let x = 0; x < W - 1; x++) {
        const a = patch[y * W + x], b = patch[y * W + x + 1]
        if (!Number.isFinite(a) || !Number.isFinite(b)) continue
        ;((x + 1) % PX === 0 ? acc.coutureX : acc.dedansX).push(Math.abs(b - a))
      }
      for (let y = 0; y < H - 1; y++) for (let x = 0; x < W; x++) {
        const a = patch[y * W + x], b = patch[(y + 1) * W + x]
        if (!Number.isFinite(a) || !Number.isFinite(b)) continue
        ;((y + 1) % PX === 0 ? acc.coutureY : acc.dedansY).push(Math.abs(b - a))
      }
      const st = (a) => {
        if (!a.length) return { moy: NaN, p99: NaN, max: NaN, n: 0 }
        const b = a.slice().sort((u, v) => u - v)
        return { moy: +(a.reduce((s, v) => s + v, 0) / a.length).toFixed(2), p99: +b[Math.floor(0.99 * b.length)].toFixed(2), max: +b[b.length - 1].toFixed(2), n: a.length }
      }
      let nan = 0
      for (const v of patch) if (!Number.isFinite(v)) nan++
      out.push({
        z, mode, tuiles: zs2.length, sansBathy: zs2.filter((v) => v < 0).length,
        ancetres: [...new Set(zs2)].sort((a, b) => b - a).join(','),
        pxNaN: nan, partNaN: +((100 * nan) / patch.length).toFixed(1),
        dedansX: st(acc.dedansX), coutureX: st(acc.coutureX),
        dedansY: st(acc.dedansY), coutureY: st(acc.coutureY),
      })
    }
  }
  return out
}, LAT, LON, ZS, LARGEUR)

console.log(`\n${NOM} · bande de ${LARGEUR}×${LARGEUR} tuiles`)
console.log('   z  mode    tuiles sans-bathy  ancêtres      px NaN (%)  |Δ| DEDANS x moy/p99/max   |Δ| COUTURE x moy/p99/max   | DEDANS y   COUTURE y')
for (const r of R) {
  console.log(`  ${String(r.z).padStart(2)}  ${r.mode.padEnd(7)} ${String(r.tuiles).padStart(4)} ${String(r.sansBathy).padStart(9)}  ${r.ancetres.padEnd(12)} ${String(r.partNaN).padStart(6)} %   ${String(r.dedansX.moy).padStart(7)}/${String(r.dedansX.p99).padStart(7)}/${String(r.dedansX.max).padStart(8)}   ${String(r.coutureX.moy).padStart(7)}/${String(r.coutureX.p99).padStart(7)}/${String(r.coutureX.max).padStart(8)}   ${String(r.dedansY.moy).padStart(6)}/${String(r.dedansY.p99).padStart(6)}   ${String(r.coutureY.moy).padStart(7)}/${String(r.coutureY.p99).padStart(7)}`)
}
fs.writeFileSync(path.join(ICI, `marches-${NOM}.json`), JSON.stringify(R, null, 2))
await nav.close()
