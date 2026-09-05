// BANC CAR — sonde rAF sur le cartouche pendant les crans (N3 mensonge, N4
// claquement, N5 taille, N6 fragments). Rejoue le vol de VID2 : Provence z9,
// caméra à maxDistance, deux crans par palier z10→z13, puis 3 crans arrière
// (WIDENING). Chaque image est relevée dans la page par requestAnimationFrame.
//   node scripts/banc-car.mjs <port> <dossier de sortie>
import fs from 'node:fs'
import path from 'node:path'
const PORT = process.argv[2] || '10711'
const SORTIE = process.argv[3] || '.banc/CAR/run'
const puppeteer = (await import('file:///C:/Dev/wt-f3/node_modules/puppeteer-core/lib/puppeteer/puppeteer-core.js')).default
fs.mkdirSync(SORTIE, { recursive: true })
const dodo = (ms) => new Promise((r) => setTimeout(r, ms))
const nav = await puppeteer.launch({
  executablePath: 'C:/Program Files/Google/Chrome/Application/chrome.exe',
  headless: 'new',
  args: ['--headless=new', '--no-sandbox', '--use-angle=d3d11', '--enable-gpu', '--ignore-gpu-blocklist', '--window-size=1280,900'],
})
const journal = { pid: nav.process()?.pid, console: [], pageerror: [], etapes: [], images: [] }
const log = (...a) => console.log(...a)
try {
  const page = await nav.newPage()
  await page.setViewport({ width: 1280, height: 800 })
  page.on('console', (m) => { const t = m.type(); if (/error|warn/.test(t)) journal.console.push(t + ': ' + m.text().slice(0, 300)) })
  page.on('pageerror', (e) => journal.pageerror.push(String(e.message).slice(0, 400)))
  await page.goto(`http://127.0.0.1:${PORT}/`, { waitUntil: 'domcontentloaded', timeout: 180000 })
  await page.waitForFunction(() => window.__exp?.modes && window.__exp?.globe && window.__exp?.groundInfo, { timeout: 180000, polling: 100 })
  await dodo(12000)
  await page.keyboard.press('Escape')
  await dodo(2000)
  // ── la sonde rAF, posée dans la page ──
  await page.evaluate(() => {
    const e = window.__exp, g = e.globe, gi = e.groundInfo
    const largeurParois = () => {
      const m = g._parois
      if (!m?.geometry) return null
      if (!m.geometry.boundingBox) m.geometry.computeBoundingBox()
      const b = m.geometry.boundingBox
      const sx = Math.hypot(m.matrixWorld.elements[0], m.matrixWorld.elements[1], m.matrixWorld.elements[2])
      return (b.max.x - b.min.x) * sx
    }
    window.__sondeCAR = []
    window.__marqueCAR = ''
    const t0 = performance.now()
    const tick = () => {
      const lp = largeurParois()
      const cartK = gi.group.parent?.scale?.x ?? null
      window.__sondeCAR.push({
        t: +(performance.now() - t0).toFixed(1),
        m: window.__marqueCAR,
        z: e.params.demZoom,
        lat: +e.params.demLat.toFixed(4), lon: +e.params.demLon.toFixed(4),
        v: gi.group.visible, coord: gi.lastInfo?.coord ?? null, nom: gi.lastInfo?.name ?? null,
        nMesh: gi.meshes.length,
        cloudsV: e.clouds?.group?.visible,
        busy: e.modes.busy,
        msg: e.modes.msgEl?.classList.contains('hidden') ? '' : e.modes.msgEl?.textContent,
        rapport: cartK && lp ? +((cartK * 56) / lp).toFixed(3) : null,
        cropDemi: g.uniforms?.uCropDemi?.value ?? null,
        baseY: g.baseYCrop,
      })
      requestAnimationFrame(tick)
    }
    requestAnimationFrame(tick)
  })
  const marque = (m) => page.evaluate((m) => { window.__marqueCAR = m }, m)
  const capture = async (tag) => { await page.screenshot({ path: path.join(SORTIE, tag + '.png') }); journal.images.push(tag) }
  const rafale = async (prefixe, n, pas) => { for (let i = 0; i < n; i++) { await capture(`${prefixe}-${String(i).padStart(2, '0')}`); await dodo(pas) } }
  const attendreRepos = async (max = 40000) => { const t0 = Date.now(); await dodo(300); while (Date.now() - t0 < max) { if (!(await page.evaluate(() => window.__exp.modes.busy))) break; await dodo(200) } }

  await marque('flyTo')
  await page.evaluate(() => window.__exp.modes.flyTo(44.3425, 5.7777, 9))
  await dodo(3000); await attendreRepos(60000); await dodo(6000)
  await capture('01-z09')
  await page.evaluate(() => { const e = window.__exp, c = e.controls; const dir = e.camera.position.clone().sub(c.target).normalize(); e.camera.position.copy(c.target).addScaledVector(dir, c.maxDistance); c.update() })
  await dodo(4000); await capture('02-z09-haut')
  // le glissé de VID2 (03-z09-incline) : il déplace la cible, donc le LIEU du
  // prochain palier — sans lui les coordonnées ne changent pas d'un cran à
  // l'autre et N3 ne peut pas se voir
  const glisse = async (dx, dy) => {
    await page.mouse.move(640, 380); await page.mouse.down()
    for (let i = 1; i <= 10; i++) { await page.mouse.move(640 + i * dx, 380 + i * dy); await dodo(16) }
    await page.mouse.up(); await dodo(2500)
  }
  await glisse(2, 4); await capture('03-z09-incline')
  for (let z = 10; z <= 13; z++) {
    if (z > 10) await glisse(z % 2 ? 6 : -6, 2)
    await marque(`cran-z${z}`)
    await page.evaluate(() => window.__exp.modes.cranZoom(1)); await dodo(250)
    await page.evaluate(() => window.__exp.modes.cranZoom(1))
    await rafale(`04-z${z}`, 6, 300)
    await attendreRepos(60000); await dodo(6000); await capture(`05-z${z}-repos`)
  }
  await marque('sortie1')
  for (let i = 0; i < 3; i++) { await page.evaluate(() => window.__exp.modes.cranZoom(-1)); await dodo(150) }
  await rafale('07-sortie', 8, 200)
  await attendreRepos(60000); await dodo(5000); await capture('08-sortie-repos')
  await marque('sortie2')
  for (let i = 0; i < 3; i++) { await page.evaluate(() => window.__exp.modes.cranZoom(-1)); await dodo(150) }
  await rafale('09-sortie2', 8, 200)
  await attendreRepos(60000); await dodo(5000); await capture('10-sortie2-repos')
  journal.sonde = await page.evaluate(() => window.__sondeCAR)
} catch (er) { log('ERREUR BANC', er); journal.erreurBanc = String(er) } finally {
  fs.writeFileSync(path.join(SORTIE, 'journal.json'), JSON.stringify(journal))
  log('images rAF :', journal.sonde?.length, '· console :', [...new Set(journal.console)].slice(0, 5), '· pageerror :', journal.pageerror)
  await nav.close()
}
