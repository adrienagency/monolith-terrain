// R15 — D'OÙ VIENT LE SAUT D'ALTITUDE DE FOND ? `dem.meanM` PAR IMAGE.
//
// ⛔ LECTURE SEULE SUR `src/`. Molette arrière→avant depuis l'orbite, et on
// enregistre à CHAQUE IMAGE (par un `requestAnimationFrame` posé par la sonde,
// donc APRÈS celui de l'application) :
//   · `dem.meanM`, `dem.zoom`, `params.source`, la présence de `dem` ;
//   · `altitudeCadrageM()` et le rayon de `camGlobe`.
//
// **Ce qu'on cherche** : le rapport d'altitude de fond MAX est passé de 1,0313
// à 1,1757 avec la correction. Il faut savoir si c'est un PALIER de `dem.meanM`
// (donc inhérent au bloc) ou une image où `dem` manque (donc un trou à boucher).
//
//   node scripts/diag-r15-saut.mjs --port 5555 --etiquette saut

import fs from 'node:fs'
import path from 'node:path'
import { fileURLToPath } from 'node:url'

const RACINE = path.dirname(path.dirname(fileURLToPath(import.meta.url)))
const A = process.argv.slice(2)
const opt = (n, d) => { const i = A.indexOf(n); return i >= 0 && A[i + 1] !== undefined ? A[i + 1] : d }
const PORT = Number(opt('--port', '5555'))
const ETIQ = opt('--etiquette', 'saut')
const CRANS = Number(opt('--crans', '150'))
const ICI = path.join(RACINE, '.banc', 'R15')
fs.mkdirSync(ICI, { recursive: true })

function trouverChrome () {
  const donne = opt('--chrome', process.env.CHROME_PATH)
  if (donne) return donne
  const pistes = ['C:/Program Files/Google/Chrome/Application/chrome.exe', 'C:/Program Files (x86)/Google/Chrome/Application/chrome.exe', '/usr/bin/google-chrome']
  const t = pistes.find((p) => fs.existsSync(p))
  if (!t) { console.error('Chrome introuvable'); process.exit(2) }
  return t
}
async function chargerPuppeteer () {
  const pistes = [
    path.join(RACINE, 'node_modules/puppeteer-core/lib/puppeteer/puppeteer-core.js'),
    'C:/Dev/wt-f3/node_modules/puppeteer-core/lib/puppeteer/puppeteer-core.js',
  ]
  for (const p of pistes) if (fs.existsSync(p)) return (await import('file:///' + p.replace(/\\/g, '/'))).default
  console.error('puppeteer-core introuvable'); process.exit(2)
}
const dodo = (ms) => new Promise((r) => setTimeout(r, ms))

const puppeteer = await chargerPuppeteer()
const nav = await puppeteer.launch({
  executablePath: trouverChrome(),
  headless: true,
  args: ['--headless=new', '--no-sandbox', '--enable-unsafe-swiftshader', '--window-size=1280,900'],
})
try {
  const page = await nav.newPage()
  await page.setViewport({ width: 1280, height: 800 })
  const erreurs = []
  page.on('pageerror', (er) => erreurs.push(String(er.message).slice(0, 200)))
  await page.goto(`http://localhost:${PORT}/`, { waitUntil: 'domcontentloaded', timeout: 120000 })
  await page.waitForFunction(() => window.__exp?.modes && window.__exp?.globe, { timeout: 90000, polling: 100 })
  await dodo(9000)
  await page.keyboard.press('Escape')
  await dodo(1500)
  await page.evaluate(() => {
    const x = window.__exp
    x.__trace = []
    const boucle = () => {
      const d = x.dem
      x.__trace.push({
        t: performance.now(),
        aDem: !!d, source: x.params?.source, zoom: d?.zoom ?? null,
        meanM: d?.meanM ?? null,
        alt: x.altitudeCadrageM?.() ?? null,
        rG: x.camGlobe ? Math.hypot(x.camGlobe.position.x, x.camGlobe.position.y, x.camGlobe.position.z) : null,
        mode: x.modes?.mode,
      })
      if (x.__trace.length < 20000) requestAnimationFrame(boucle)
    }
    requestAnimationFrame(boucle)
  })
  // molette avant, en continu : la descente ordinaire
  const cible = await page.evaluate(() => ({ w: innerWidth / 2, h: innerHeight / 2 }))
  for (let i = 0; i < CRANS; i++) {
    await page.mouse.wheel({ deltaY: -120 })
    await dodo(90)
  }
  await dodo(9000)
  const tr = await page.evaluate(() => window.__exp.__trace)
  const OMPU = 63710
  const lignes = []
  let pire = { r: 1 }
  for (let i = 1; i < tr.length; i++) {
    const a = tr[i - 1], b = tr[i]
    if (!(a.rG > 100) || !(b.rG > 100)) continue
    const altA = (a.rG - 100) * OMPU, altB = (b.rG - 100) * OMPU
    const r = Math.max(altA / altB, altB / altA)
    if (r > 1.05) lignes.push({ i, r, a, b, altA, altB })
    if (r > pire.r) pire = { r, i, a, b, altA, altB }
  }
  console.log(`images ${tr.length} · erreurs de page ${erreurs.length}`)
  console.log(`PIRE rapport d'altitude de fond : ${pire.r?.toFixed(4)}`)
  if (pire.a) {
    console.log(`  image ${pire.i} : ${Math.round(pire.altA)} m → ${Math.round(pire.altB)} m`)
    console.log(`  avant : dem=${pire.a.aDem} z${pire.a.zoom} meanM=${pire.a.meanM == null ? '—' : Math.round(pire.a.meanM)} alt=${Math.round(pire.a.alt)} source=${pire.a.source}`)
    console.log(`  après : dem=${pire.b.aDem} z${pire.b.zoom} meanM=${pire.b.meanM == null ? '—' : Math.round(pire.b.meanM)} alt=${Math.round(pire.b.alt)} source=${pire.b.source}`)
  }
  console.log(`\nles ${Math.min(lignes.length, 25)} sauts > 1,05 :`)
  for (const l of lignes.slice(0, 25)) {
    console.log(`  n${l.i} ×${l.r.toFixed(4)} | ${Math.round(l.altA)}→${Math.round(l.altB)} m | z${l.a.zoom}→z${l.b.zoom} | meanM ${l.a.meanM == null ? '—' : Math.round(l.a.meanM)}→${l.b.meanM == null ? '—' : Math.round(l.b.meanM)} | alt ${Math.round(l.a.alt)}→${Math.round(l.b.alt)} | dem ${l.a.aDem}→${l.b.aDem}`)
  }
  fs.writeFileSync(path.join(ICI, `${ETIQ}.json`), JSON.stringify({ trace: tr, erreurs }, null, 0))
  console.log(`→ .banc/R15/${ETIQ}.json`)
} finally {
  await nav.close()
}
