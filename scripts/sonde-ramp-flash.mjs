// RAMP — LE RETARD DE ~300 ms, TRAITÉ À PART.
//
// ⚠️ **C'EST UN SECOND DÉFAUT, DISTINCT DE LA RAMPE FIXE**, et le brief le dit :
// même avec une rampe fixe, une image peut porter l'ancien réglage. SUR l'a vu
// à l'écran (`.banc/SUR-SHOT/c7.1.png`, la montagne verte le temps d'un
// rafraîchissement) et l'a chiffré à ~300 ms.
//
// ⚡ **ON LE MESURE PAR ÉCHANTILLONNAGE PAR IMAGE, PAS PAR CAPTURE.** On note à
// chaque image `uHeightRange` (le domaine, qui change quand le MNT est posé) et
// le couple `uHeightPivot` / `uHeightContrast` (le réglage). Le retard est
// l'intervalle entre le changement de l'UN et celui de l'AUTRE, et le nombre
// d'IMAGES rendues entre les deux — c'est ce nombre-là qu'Adrien voit.
import pupmod from 'file:///C:/Dev/wt-f3/node_modules/puppeteer-core/lib/puppeteer/puppeteer-core.js'
import fs from 'node:fs'

const pup = pupmod.default ?? pupmod
const A = process.argv.slice(2)
const opt = (n, d) => { const i = A.indexOf(n); return i >= 0 && A[i + 1] !== undefined ? A[i + 1] : d }
const PORT = opt('--port', '9341')
const OUT = opt('--out', '.banc/RAMP-FLASH')
const RENORM = A.includes('--renorm')
fs.mkdirSync(OUT, { recursive: true })

const nav = await pup.launch({
  executablePath: 'C:/Program Files/Google/Chrome/Application/chrome.exe',
  headless: 'new',
  args: ['--window-size=1280,920', '--use-angle=default'],
  defaultViewport: { width: 1280, height: 800 },
})
console.log('PID chrome', nav.process()?.pid)
const page = (await nav.pages())[0]
const dodo = (ms) => new Promise((r) => setTimeout(r, ms))
await page.goto(`http://127.0.0.1:${PORT}/`, { waitUntil: 'domcontentloaded', timeout: 90000 })
await page.waitForFunction('!!(window.__exp && window.__exp.modes)', { timeout: 120000 })
await page.waitForFunction("!!document.getElementById('loading')?.classList.contains('hidden')", { timeout: 180000 })
for (let k = 0; k < 8; k++) { await page.keyboard.press('Escape').catch(() => {}); await dodo(150) }
await page.evaluate(() => { document.body.classList.remove('ce-hub'); document.querySelector('.ce-hubveil')?.remove() })
await dodo(2500)
if (RENORM) await page.evaluate(() => window.__exp.setRampeRenormalise(true))
await page.evaluate(() => window.__exp.modes.flyTo(46.0122, 7.8223, 11))
await dodo(15000)

// la sonde par image — ⚠️ POSÉE AVANT LE GESTE, jamais après : « une sonde
// posée APRÈS la fonction lit un état écrasé » (brief).
await page.evaluate(() => {
  const u = window.__exp.terrain.mapUniforms
  const j = []
  let dr = null, dp = null, img = 0
  window.__flash = { j }
  const tic = () => {
    img++
    const r = `${u.uHeightRange.value.x},${u.uHeightRange.value.y}`
    const p = `${u.uHeightPivot.value},${u.uHeightContrast.value}`
    const t = performance.now()
    if (dr !== null && r !== dr) j.push({ quoi: 'domaine', t, img })
    if (dp !== null && p !== dp) j.push({ quoi: 'reglage', t, img })
    dr = r; dp = p
    requestAnimationFrame(tic)
  }
  requestAnimationFrame(tic)
})

for (let c = 0; c < 6; c++) { await page.evaluate(() => window.__exp.modes.cranZoom(1)); await dodo(3500) }
const j = await page.evaluate(() => window.__flash.j)
fs.writeFileSync(`${OUT}/${RENORM ? 'renorm' : 'fixe'}.json`, JSON.stringify(j, null, 1))

// pour chaque changement de DOMAINE : le prochain changement de RÉGLAGE
const retards = []
for (let i = 0; i < j.length; i++) {
  if (j[i].quoi !== 'domaine') continue
  const suiv = j.slice(i + 1).find((x) => x.quoi === 'reglage')
  if (!suiv) continue
  const dt = suiv.t - j[i].t
  if (dt > 2000) continue // un autre geste, pas ce chargement-ci
  retards.push({ ms: +dt.toFixed(1), images: suiv.img - j[i].img })
}
const domaines = j.filter((x) => x.quoi === 'domaine').length
const reglages = j.filter((x) => x.quoi === 'reglage').length
console.log(`\n${RENORM ? 'OPTION COCHÉE (le dépôt d’avant)' : 'RAMPE FIXE (le défaut du jour)'}`)
console.log(`changements de domaine : ${domaines} · changements de réglage : ${reglages}`)
if (!retards.length) {
  console.log('⚡ AUCUN décalage domaine → réglage : 0 image portant l’ancien réglage.')
} else {
  const ms = retards.map((r) => r.ms), im = retards.map((r) => r.images)
  console.log(`décalages : ${retards.length}`)
  console.log(`   ms     : min ${Math.min(...ms)} · médiane ${ms.sort((a, b) => a - b)[ms.length >> 1]} · max ${Math.max(...ms)}`)
  console.log(`   IMAGES portant l’ancien réglage : min ${Math.min(...im)} · max ${Math.max(...im)}`)
}
await nav.close()
