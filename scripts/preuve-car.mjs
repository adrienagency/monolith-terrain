// PREUVE CAR — captures « aux images de la vidéo » : caméra inclinée comme
// m_089 (le texte sud du cartouche dans le cadre), puis un REFINING et un
// WIDENING photographiés toutes les 100 ms, avec la sonde rAF en parallèle.
//   node scripts/preuve-car.mjs <port> <dossier>
import fs from 'node:fs'
import path from 'node:path'
const PORT = process.argv[2] || '10711'
const SORTIE = process.argv[3] || '.banc/CAR/preuve'
const puppeteer = (await import('file:///C:/Dev/wt-f3/node_modules/puppeteer-core/lib/puppeteer/puppeteer-core.js')).default
fs.mkdirSync(SORTIE, { recursive: true })
const dodo = (ms) => new Promise((r) => setTimeout(r, ms))
const nav = await puppeteer.launch({
  executablePath: 'C:/Program Files/Google/Chrome/Application/chrome.exe',
  headless: 'new',
  args: ['--headless=new', '--no-sandbox', '--use-angle=d3d11', '--enable-gpu', '--ignore-gpu-blocklist', '--window-size=1280,900'],
})
const journal = { pid: nav.process()?.pid, images: [] }
try {
  const page = await nav.newPage()
  await page.setViewport({ width: 1280, height: 800 })
  await page.goto(`http://127.0.0.1:${PORT}/`, { waitUntil: 'domcontentloaded', timeout: 180000 })
  await page.waitForFunction(() => window.__exp?.modes && window.__exp?.globe && window.__exp?.groundInfo, { timeout: 180000, polling: 100 })
  await dodo(12000)
  await page.keyboard.press('Escape')
  await dodo(2000)
  await page.evaluate(() => {
    const e = window.__exp, g = e.globe, gi = e.groundInfo
    window.__sondeCAR = []; window.__marqueCAR = ''
    const t0 = performance.now()
    const tick = () => {
      const m = g._parois; let lp = null
      if (m?.geometry) { if (!m.geometry.boundingBox) m.geometry.computeBoundingBox(); const b = m.geometry.boundingBox; lp = (b.max.x - b.min.x) * Math.hypot(m.matrixWorld.elements[0], m.matrixWorld.elements[1], m.matrixWorld.elements[2]) }
      const cartK = gi.group.parent?.scale?.x ?? null
      window.__sondeCAR.push({ t: +(performance.now() - t0).toFixed(1), m: window.__marqueCAR, z: e.params.demZoom, lat: +e.params.demLat.toFixed(4), lon: +e.params.demLon.toFixed(4), v: gi.group.visible, coord: gi.lastInfo?.coord ?? null, nom: gi.lastInfo?.name ?? null, busy: e.modes.busy, rapport: cartK && lp ? +((cartK * 56) / lp).toFixed(3) : null })
      requestAnimationFrame(tick)
    }
    requestAnimationFrame(tick)
  })
  const marque = (m) => page.evaluate((m) => { window.__marqueCAR = m }, m)
  const capture = async (tag) => { const t = await page.evaluate(() => performance.now()); await page.screenshot({ path: path.join(SORTIE, tag + '.png') }); journal.images.push({ tag, t }) }
  const rafale = async (p, n, pas) => { for (let i = 0; i < n; i++) { await capture(`${p}-${String(i).padStart(2, '0')}`); await dodo(pas) } }
  const attendreRepos = async (max = 40000) => { const t0 = Date.now(); await dodo(300); while (Date.now() - t0 < max) { if (!(await page.evaluate(() => window.__exp.modes.busy))) break; await dodo(200) } }
  await marque('flyTo')
  await page.evaluate(() => window.__exp.modes.flyTo(44.3425, 5.7777, 9))
  await dodo(3000); await attendreRepos(60000); await dodo(6000)
  await page.evaluate(() => { const e = window.__exp, c = e.controls; const dir = e.camera.position.clone().sub(c.target).normalize(); e.camera.position.copy(c.target).addScaledVector(dir, c.maxDistance); c.update() })
  await dodo(3000)
  // deux crans pour être à z10, puis l'inclinaison forte (le pas de VID2 `06-z14-incline`)
  await marque('cran-z10')
  await page.evaluate(() => window.__exp.modes.cranZoom(1)); await dodo(250)
  await page.evaluate(() => window.__exp.modes.cranZoom(1))
  await attendreRepos(60000); await dodo(6000)
  await page.mouse.move(640, 300); await page.mouse.down()
  for (let i = 1; i <= 12; i++) { await page.mouse.move(640 + i * 3, 300 + i * 6); await dodo(16) }
  await page.mouse.up(); await dodo(3000); await capture('00-z10-incline')
  await marque('refining')
  await page.evaluate(() => window.__exp.modes.cranZoom(1)); await dodo(250)
  await page.evaluate(() => window.__exp.modes.cranZoom(1))
  await rafale('10-refining', 14, 100)
  await attendreRepos(60000); await dodo(6000); await capture('11-refining-repos')
  await marque('widening')
  for (let i = 0; i < 3; i++) { await page.evaluate(() => window.__exp.modes.cranZoom(-1)); await dodo(120) }
  await rafale('20-widening', 14, 100)
  await attendreRepos(60000); await dodo(6000); await capture('21-widening-repos')
  journal.sonde = await page.evaluate(() => window.__sondeCAR)
} catch (er) { console.log('ERREUR', er); journal.erreur = String(er) } finally {
  fs.writeFileSync(path.join(SORTIE, 'journal.json'), JSON.stringify(journal))
  console.log('images rAF :', journal.sonde?.length, 'captures :', journal.images.length)
  await nav.close()
}
