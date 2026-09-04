// DIAG CULL — un relevé nu : le repère du crop, le recensement du cache par
// niveau (dans / hors l'emprise), et un premier essai de la mesure de trous.
// Sert à VÉRIFIER L'INSTRUMENT avant d'en croire un chiffre.
//   node scripts/diag-cull.mjs --port 8137 --alt 30000 --lieu majorque
import fs from 'node:fs'
import path from 'node:path'
import { fileURLToPath } from 'node:url'
const RACINE = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..')
const A = process.argv.slice(2)
const opt = (n, d = null) => { const i = A.indexOf(n); return i >= 0 && A[i + 1] !== undefined ? A[i + 1] : d }
const PORT = Number(opt('--port', '8137'))
const ALT = Number(opt('--alt', '30000'))
const LIEUX = { majorque: [39.62, 2.98], bretagne: [48.38, -4.49], alpes: [45.92, 6.87] }
const LIEU = opt('--lieu', 'majorque')
const dodo = (ms) => new Promise((r) => setTimeout(r, ms))
async function chargerPuppeteer() {
  for (const p of [path.join(RACINE, 'node_modules/puppeteer-core/lib/puppeteer/puppeteer-core.js'), 'C:/Dev/wt-f3/node_modules/puppeteer-core/lib/puppeteer/puppeteer-core.js'])
    if (fs.existsSync(p)) return (await import('file:///' + p.split('\\').join('/'))).default
  process.exit(2)
}
const CHROME = ['C:/Program Files/Google/Chrome/Application/chrome.exe', 'C:/Program Files (x86)/Google/Chrome/Application/chrome.exe'].find((p) => fs.existsSync(p))
const puppeteer = await chargerPuppeteer()
const nav = await puppeteer.launch({ executablePath: CHROME, headless: 'new', args: ['--window-size=1280,840', '--use-angle=default', '--no-sandbox'], defaultViewport: { width: 1280, height: 720, deviceScaleFactor: 1 } })
const page = (await nav.pages())[0]
page.on('pageerror', (e) => console.log('PAGEERROR', String(e.message).slice(0, 200)))
await page.goto(`http://127.0.0.1:${PORT}/`, { waitUntil: 'domcontentloaded', timeout: 60000 })
await page.waitForFunction('!!(window.__exp && window.__exp.globe)', { timeout: 120000 })
await page.waitForFunction("!!document.getElementById('loading')?.classList.contains('hidden')", { timeout: 240000 })
await page.keyboard.press('Escape'); await dodo(500)
await page.evaluate(() => { document.body.classList.remove('ce-hub'); document.querySelector('.ce-hubveil')?.remove() })
await page.waitForFunction('!(window.__exp.modes.busy || window.__exp.modes.travel)', { timeout: 60000, polling: 200 }).catch(() => {})
await dodo(1500)
const [lat, lon] = LIEUX[LIEU]
await page.evaluate((a, b) => window.__exp.modes.flyTo(a, b, 10), lat, lon)
await page.waitForFunction('!(window.__exp.modes.busy || window.__exp.modes.travel)', { timeout: 90000, polling: 200 }).catch(() => {})
await dodo(2000)
const altitude = () => page.evaluate(() => window.__exp.altitudeCadrageM?.() ?? null)
for (let i = 0; i < 40; i++) {
  const a = await altitude(); if (a === null) break
  const r = ALT / a
  if (r > 1.45) { await page.evaluate(() => window.__exp.modes.cranZoom(-1)) } else if (r < 0.7) { await page.evaluate(() => window.__exp.modes.cranZoom(1)) } else break
  await dodo(700)
}
await dodo(4000)
// — la largeur du crop contre celle du socle, à plusieurs altitudes —
const LARGEUR = async () => page.evaluate(async () => {
  const c = await import('/src/monde/habillage-crop.js')
  const s = await import('/src/monde/seuil-socle.js')
  const e = window.__exp, g = e.globe
  const rep = g._crop
  return {
    alt: Math.round(e.altitudeCadrageM?.() ?? -1),
    demZoom: e.params?.demZoom,
    demi: rep?.demi ?? null,
    largeurCropM: rep ? Math.round(c.largeurCropM(rep)) : null,
    largeurSocleM: Math.round(s.LARGEUR_SOCLE_M),
    zoomEquivalent: rep ? Math.round(Math.log2(3 / (2 * rep.demi)) * 100) / 100 : null,
    cache: g.tiles.size, file: g.queue.length, vol: g.inFlight,
  }
})
const echelle = []
echelle.push(await LARGEUR())
for (let k = 0; k < 14; k++) {
  await page.evaluate(() => { const el = window.__exp.renderer.domElement; for (let i = 0; i < 12; i++) el.dispatchEvent(new WheelEvent('wheel', { deltaY: -120, clientX: innerWidth / 2, clientY: innerHeight / 2, bubbles: true, cancelable: true })) })
  await dodo(1200)
  echelle.push(await LARGEUR())
}
console.log('ÉCHELLE', JSON.stringify(echelle, null, 1))
await dodo(3000)
const rap = await page.evaluate(async () => {
  const m = await import('/src/monde/crop-sphere.js')
  const e = window.__exp, g = e.globe
  const parZ = {}
  for (const t of g.tiles.values()) {
    const k = t.z
    parZ[k] ??= { n: 0, hors: 0, maille: 0, mailleHors: 0, dessine: 0, dessineHors: 0 }
    const s = parZ[k]; s.n++
    const hors = g._crop ? !m.tuileDansCrop(t.z, t.x, t.y, g._crop) : false
    if (hors) s.hors++
    if (t.mesh) { s.maille++; if (hors) s.mailleHors++ }
    if (t.mesh?.visible) { s.dessine++; if (hors) s.dessineHors++ }
  }
  return {
    alt: e.altitudeCadrageM?.(), mode: e.modes.mode,
    crop: g._crop ? { cx: g._crop.cx, cy: g._crop.cy, demi: g._crop.demi } : null,
    cropSeul: g._cropSeul, estompage: g.uniforms?.uEstompage?.value, estompageOn: g.uniforms?.uEstompageOn?.value,
    cache: g.tiles.size, cacheMax: g.cacheMax, continu: g.continu,
    camAlt: (e.camera.position.length() - g.radius) * 63710,
    globeCam: g._camPos ? [g._camPos.x, g._camPos.y, g._camPos.z] : null,
    groupePos: [g.group.position.x, g.group.position.y, g.group.position.z], groupeEchelle: g.group.scale.x,
    groupeParent: g.group.parent?.type + '/' + (g.group.parent?.name || ''),
    sceneEnfants: e.scene.children.map((c) => c.type + ':' + (c.name || '') + ':' + c.visible).slice(0, 40),
    parZ,
  }
})
console.log(JSON.stringify(rap, null, 1))
await nav.close()
