// Agrandit une région d'une capture PNG (canevas 2D d'une page vierge).
//   node scripts/zoom-png.mjs entree.png sortie.png x0 y0 x1 y1 [facteur]
import fs from 'node:fs'
const [entree, sortie, x0, y0, x1, y1, f = 3] = process.argv.slice(2)
const puppeteer = (await import('file:///C:/Dev/wt-f3/node_modules/puppeteer-core/lib/puppeteer/puppeteer-core.js')).default
const nav = await puppeteer.launch({ executablePath: 'C:/Program Files/Google/Chrome/Application/chrome.exe', headless: 'new', args: ['--headless=new', '--no-sandbox'] })
try {
  const page = await nav.newPage()
  const w = (x1 - x0) * f, h = (y1 - y0) * f
  await page.setViewport({ width: Math.ceil(w), height: Math.ceil(h) })
  await page.setContent('<body style="margin:0"><canvas id=c></canvas></body>')
  await page.evaluate(async (b64, x0, y0, x1, y1, f) => {
    const img = new Image(); img.src = 'data:image/png;base64,' + b64; await img.decode()
    const c = document.getElementById('c'); c.width = (x1 - x0) * f; c.height = (y1 - y0) * f
    const x = c.getContext('2d'); x.imageSmoothingEnabled = false
    x.drawImage(img, x0, y0, x1 - x0, y1 - y0, 0, 0, c.width, c.height)
  }, fs.readFileSync(entree).toString('base64'), +x0, +y0, +x1, +y1, +f)
  await page.screenshot({ path: sortie })
} finally { await nav.close() }
