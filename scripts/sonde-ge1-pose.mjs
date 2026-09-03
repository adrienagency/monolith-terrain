// Reconnaissance : que devient la pose de démarrage si on N'APPUIE PAS sur Échap ?
// Relève mode / d / altitude toutes les secondes pendant 30 s après `#loading`.
const pup = (await import('file:///C:/Dev/wt-f3/node_modules/puppeteer-core/lib/puppeteer/puppeteer-core.js')).default
const PORT = Number(process.argv[2] || 6771)
const nav = await pup.launch({
  executablePath: 'C:/Program Files/Google/Chrome/Application/chrome.exe',
  headless: 'new', args: ['--window-size=1280,920', '--use-angle=default'],
  defaultViewport: { width: 1280, height: 800 },
})
const page = (await nav.pages())[0]
await page.goto(`http://127.0.0.1:${PORT}/`, { waitUntil: 'domcontentloaded', timeout: 90000 })
await page.waitForFunction('!!(window.__exp && window.__exp.controls && window.__exp.modes)', { timeout: 120000 })
await page.waitForFunction("!!document.getElementById('loading')?.classList.contains('hidden')", { timeout: 180000 })
const t0 = Date.now()
for (let i = 0; i < 30; i++) {
  const s = await page.evaluate(() => {
    const e = window.__exp, c = e.controls, m = e.modes
    const g = e.camGlobe ?? e.camera
    return {
      mode: m.mode, busy: !!m.busy, d: +e.camera.position.distanceTo(c.target).toFixed(3),
      altFondM: Math.round((g.position.length() - 100) * 63710),
      hub: document.body.classList.contains('ce-hub'),
      sous: document.elementFromPoint(640, 400)?.tagName ?? null,
    }
  })
  console.log(((Date.now() - t0) / 1000).toFixed(1) + ' s', JSON.stringify(s))
  await new Promise((r) => setTimeout(r, 1000))
}
// puis Échap et re-relevé
for (let k = 0; k < 8; k++) {
  await page.keyboard.press('Escape').catch(() => {})
  await new Promise((r) => setTimeout(r, 300))
  const sous = await page.evaluate(() => document.elementFromPoint(640, 400)?.tagName ?? null)
  if (sous === 'CANVAS') break
}
for (let i = 0; i < 8; i++) {
  const s = await page.evaluate(() => {
    const e = window.__exp, c = e.controls, m = e.modes
    const g = e.camGlobe ?? e.camera
    return { mode: m.mode, busy: !!m.busy, d: +e.camera.position.distanceTo(c.target).toFixed(3), altFondM: Math.round((g.position.length() - 100) * 63710), sous: document.elementFromPoint(640, 400)?.tagName ?? null }
  })
  console.log('apres-echap ' + i, JSON.stringify(s))
  await new Promise((r) => setTimeout(r, 1000))
}
await nav.close()
