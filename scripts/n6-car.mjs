// N6 — ATTRIBUER LES FRAGMENTS ORANGE DE WIDENING. Trois variantes du même vol
// (z12 au repos → 3 crans arrière), captures toutes les 100 ms, comptage des
// pixels orange par DIFFÉRENCE avec le témoin au repos (le pixel se lit dans un
// canevas 2D d'une page vierge — pas dans la page WebGL, où readPixels rend 0).
//   node scripts/n6-car.mjs <port> <variante: defaut|sansCartouche|sansGrille> <dossier>
import fs from 'node:fs'
import path from 'node:path'
const PORT = process.argv[2] || '10711'
const VARIANTE = process.argv[3] || 'defaut'
const SORTIE = process.argv[4] || `.banc/CAR/n6-${VARIANTE}`
const puppeteer = (await import('file:///C:/Dev/wt-f3/node_modules/puppeteer-core/lib/puppeteer/puppeteer-core.js')).default
fs.mkdirSync(SORTIE, { recursive: true })
const dodo = (ms) => new Promise((r) => setTimeout(r, ms))
const nav = await puppeteer.launch({
  executablePath: 'C:/Program Files/Google/Chrome/Application/chrome.exe',
  headless: 'new',
  args: ['--headless=new', '--no-sandbox', '--use-angle=d3d11', '--enable-gpu', '--ignore-gpu-blocklist', '--window-size=1280,900'],
})
const journal = { variante: VARIANTE, pid: nav.process()?.pid, etat: null, captures: [] }
try {
  const page = await nav.newPage()
  await page.setViewport({ width: 1280, height: 800 })
  await page.goto(`http://127.0.0.1:${PORT}/`, { waitUntil: 'domcontentloaded', timeout: 180000 })
  await page.waitForFunction(() => window.__exp?.modes && window.__exp?.globe && window.__exp?.groundInfo, { timeout: 180000, polling: 100 })
  await dodo(12000)
  await page.keyboard.press('Escape')
  await dodo(2000)
  const attendreRepos = async (max = 40000) => { const t0 = Date.now(); await dodo(300); while (Date.now() - t0 < max) { if (!(await page.evaluate(() => window.__exp.modes.busy))) break; await dodo(200) } }
  await page.evaluate(() => window.__exp.modes.flyTo(44.3425, 5.7777, 9))
  await dodo(3000); await attendreRepos(60000); await dodo(6000)
  await page.evaluate(() => { const e = window.__exp, c = e.controls; const dir = e.camera.position.clone().sub(c.target).normalize(); e.camera.position.copy(c.target).addScaledVector(dir, c.maxDistance); c.update() })
  await dodo(3000)
  for (let z = 10; z <= 12; z++) {
    await page.evaluate(() => window.__exp.modes.cranZoom(1)); await dodo(250)
    await page.evaluate(() => window.__exp.modes.cranZoom(1))
    await attendreRepos(60000); await dodo(5000)
  }
  // la variante
  journal.etat = await page.evaluate((v) => {
    const e = window.__exp, g = e.globe
    if (v === 'sansCartouche') { e.params.groundInfo = false; e.groundInfo.setVisible(false) }
    if (v === 'sansGrille') { if (g.uniforms?.uGridOpacity) g.uniforms.uGridOpacity.value = 0 }
    if (v === 'sansParois') g.setParoisVisibles(false)
    return {
      z: e.params.demZoom,
      gridOpacity: g.uniforms?.uGridOpacity?.value ?? null,
      gridColor: g.uniforms?.uGridColor?.value?.getHexString?.() ?? null,
      cartoucheV: e.groundInfo.group.visible,
      terrainGridOpacity: e.terrain?.mapUniforms?.uGridOpacity?.value ?? null,
      terrainGridColor: e.terrain?.mapUniforms?.uGridColor?.value?.getHexString?.() ?? null,
    }
  }, VARIANTE)
  await dodo(1500)
  const tampons = []
  const prise = async (tag) => { tampons.push({ tag, t: Date.now(), png: await page.screenshot({ encoding: 'base64' }) }) }
  await prise('temoin-a'); await dodo(400); await prise('temoin-b')
  const t0 = Date.now()
  for (let i = 0; i < 3; i++) { await page.evaluate(() => window.__exp.modes.cranZoom(-1)); await dodo(120) }
  for (let i = 0; i < 20; i++) { await prise(`w-${String(i).padStart(2, '0')}`); await dodo(100) }
  await attendreRepos(60000); await dodo(5000); await prise('repos')
  // ── comptage des pixels orange dans une page vierge ──
  const cpt = await nav.newPage()
  await cpt.setContent('<canvas id=c></canvas>')
  for (const s of tampons) {
    s.orange = await cpt.evaluate(async (b64) => {
      const img = new Image(); img.src = 'data:image/png;base64,' + b64
      await img.decode()
      const c = document.getElementById('c'); c.width = img.width; c.height = img.height
      const x = c.getContext('2d', { willReadFrequently: true }); x.drawImage(img, 0, 0)
      const d = x.getImageData(0, 0, c.width, c.height).data
      let n = 0, nRouge = 0
      // exclut les 60 px du haut et du bas (barres d'interface) et le panneau droit
      for (let y = 60; y < c.height - 140; y++) for (let xx = 0; xx < 990; xx++) {
        const i = (y * c.width + xx) * 4, r = d[i], g = d[i + 1], bl = d[i + 2]
        // « orange » : rouge dominant, vert moyen, bleu faible, saturé
        if (r > 150 && g > 50 && g < 140 && bl < 90 && r - bl > 90) n++
        if (r > 140 && g < 110 && bl < 90 && r - g > 60) nRouge++
      }
      return { orange: n, rouge: nRouge }
    }, s.png)
    fs.writeFileSync(path.join(SORTIE, s.tag + '.png'), Buffer.from(s.png, 'base64'))
    journal.captures.push({ tag: s.tag, dt: s.t - t0, ...s.orange })
    s.png = null
  }
} catch (er) { console.log('ERREUR', er); journal.erreur = String(er) } finally {
  fs.writeFileSync(path.join(SORTIE, 'journal.json'), JSON.stringify(journal, null, 1))
  console.log(VARIANTE, JSON.stringify(journal.etat))
  console.table(journal.captures)
  await nav.close()
}
