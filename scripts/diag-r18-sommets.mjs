// DIAGNOSTIC R18 — les sommets sont-ils POSÉS, et où atterrissent-ils ?
// ⚠️ Overpass est un service réseau : « aucun marqueur » peut vouloir dire
// « aucun sommet nommé ici » ou « la requête a échoué ». On relève les deux.
import fs from 'node:fs'
const dodo = (ms) => new Promise((r) => setTimeout(r, ms))
async function pptr() {
  for (const p of ['C:/Dev/wt-f3/node_modules/puppeteer-core/lib/puppeteer/puppeteer-core.js', 'C:/Dev/wt-warm/node_modules/puppeteer-core/lib/puppeteer/puppeteer-core.js']) if (fs.existsSync(p)) return (await import('file:///' + p)).default
  process.exit(2)
}
const puppeteer = await pptr()
const nav = await puppeteer.launch({ executablePath: 'C:/Program Files/Google/Chrome/Application/chrome.exe', headless: true, args: ['--headless=new', '--no-sandbox', '--enable-unsafe-swiftshader', '--window-size=1280,900'] })
try {
  const page = await nav.newPage()
  await page.setViewport({ width: 1280, height: 800 })
  await page.evaluateOnNewDocument(() => { try { localStorage.setItem('shibumap-ui-advanced', '1'); localStorage.setItem('shibumap-workmode', 'studio') } catch {} })
  const reseau = []
  page.on('requestfailed', (r) => { if (/overpass/.test(r.url())) reseau.push('ÉCHEC ' + r.url().slice(0, 60)) })
  page.on('response', (r) => { if (/overpass/.test(r.url())) reseau.push(r.status() + ' ' + r.url().slice(0, 60)) })
  await page.goto('http://localhost:5561/', { waitUntil: 'domcontentloaded', timeout: 120000 })
  await page.waitForFunction(() => window.__exp?.globe, { timeout: 90000, polling: 100 })
  await dodo(11000)
  await page.keyboard.press('Escape')
  await dodo(3000)
  await page.evaluate(() => { window.__exp.params.animations = false })
  const r = await page.evaluate(async () => {
    const e = window.__exp
    await e.peaksLayer.setEnabled(true)
    await new Promise((x) => setTimeout(x, 9000))
    // ⛔ **OVERPASS EST INJOIGNABLE DEPUIS CE BANC** (trois requêtes, trois
    // échecs) : sans sommet réel, la correction ne peut pas se PROUVER à
    // l'écran. On en pose donc un À LA MAIN, au CENTRE du bloc — un point dont
    // on sait où il doit tomber. C'est un témoin, pas une donnée.
    if (!e.peaksLayer.markers.length) {
      const el = document.createElement('div')
      el.className = 'peak-marker'
      const dot = document.createElement('i'); dot.className = 'peak-dot'
      const tag = document.createElement('span'); tag.className = 'peak-cart'
      const b = document.createElement('b'); b.className = 'peak-name'; b.textContent = 'TÉMOIN R18'
      const i2 = document.createElement('i'); i2.className = 'peak-alt'; i2.textContent = 'centre du bloc'
      tag.append(b, i2); el.append(dot, tag); document.body.appendChild(el)
      const y = e.terrain.sample(0, 0) + 0.5
      e.peaksLayer.markers.push({ el, tag, world: { x: 0, y, z: 0 }, name: 'TÉMOIN R18', ele: 0, lat: 0, lon: 0, tw: 0, shownFor: 999 })
      await new Promise((x) => setTimeout(x, 1500))
    }
    const m = e.peaksLayer.markers
    return {
      nb: m.length,
      opacites: m.map((x) => x.el.style.opacity),
      transform: m.slice(0, 4).map((x) => x.el.style.transform),
      monde: m.slice(0, 4).map((x) => [x.world.x.toFixed(2), x.world.y.toFixed(2), x.world.z.toFixed(2)]),
      noms: m.slice(0, 6).map((x) => x.name),
      reperes: !!document.querySelector('.peak-marker'),
    }
  })
  console.log(JSON.stringify(r, null, 1))
  console.log('réseau overpass :', reseau.join(' | ') || '(aucune requête)')
  await page.screenshot({ path: '.banc/R18/sommets-apres.png' })
} finally { await nav.close() }
