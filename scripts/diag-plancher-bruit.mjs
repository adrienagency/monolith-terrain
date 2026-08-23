// LE PLANCHER DE BRUIT, ET SA CAUSE — Tâche R6, correction du constat ④.
//
// ⛔ **CE QUI A CRÉÉ CE FICHIER.** Le premier tour de R6 a contredit R4 sur son
// plancher de bruit (« tout écart sous 9 est du bruit ») en écrivant que
// **c'était le plancher DU GRAIN**, et qu'il tombait à 0,00 une fois
// `params.animations = false` posé. Le résultat a été reproduit par la
// relecture — mais **la cause est fausse**, et le coordinateur l'a relevé :
// `main.js` porte `grain: 0, // off by default`, `NoiseEffect.blendMode.opacity`
// vaut donc zéro, et **le grain de film n'entre dans AUCUNE capture** tant que
// personne ne choisit le look « Doux ».
//
// ⚠️ **LA CAUSE COMPTE AUTANT QUE LE CHIFFRE** : une autre tâche a retiré un
// résultat de 43 % sur cette prémisse.
//
// ➡️ Ce script relève, à chaque palier : la valeur RÉELLE de `params.grain`
// dans l'application vivante, et l'écart moyen par pixel entre **deux captures
// d'un état strictement identique**, animations allumées puis coupées. Il ne
// suppose rien : il lit et il compare.
//
// EMPLOI
//   npm run dev -- --port 5519 --strictPort
//   node scripts/diag-plancher-bruit.mjs --sortie <fichier.json>
//
// ⚠️ **APRÈS UN `npm ci`, CE BANC NE DÉMARRE PAS TOUT SEUL — RÉSERVE I3.**
// `puppeteer-core` n'est PAS dans `package.json`. **La phrase à rejouer est :**
//     npm i --no-save puppeteer-core@25.8.0

import fs from 'node:fs'
import path from 'node:path'
import { fileURLToPath } from 'node:url'

const RACINE = fileURLToPath(new URL('..', import.meta.url))
const A = process.argv.slice(2)
const opt = (n, d) => { const i = A.indexOf(n); return i >= 0 && A[i + 1] ? A[i + 1] : d }
const PORT = Number(opt('--port', '5519'))
const SORTIE = opt('--sortie', null)
const PALIERS = (opt('--paliers', '2000000,120000,40000,4400')).split(',').map(Number)
const LIEU = opt('--lieu', '30.88,-5.59,12')
const ADRESSE = opt('--adresse', 'terre=unique&frontiere=1&seuil=1&globe=continu&socle=quadtree&f3=0&planete=eclairee')

function trouverChrome() {
  const donne = opt('--chrome', process.env.CHROME_PATH)
  if (donne) return donne
  const pistes = [
    'C:/Program Files/Google/Chrome/Application/chrome.exe',
    'C:/Program Files (x86)/Google/Chrome/Application/chrome.exe',
    '/Applications/Google Chrome.app/Contents/MacOS/Google Chrome',
    '/usr/bin/google-chrome', '/usr/bin/chromium',
  ]
  const t = pistes.find((p) => fs.existsSync(p))
  if (!t) { console.error('Chrome introuvable — passe --chrome <chemin>.'); process.exit(2) }
  return t
}
const puppeteer = await (async () => {
  try { return (await import('puppeteer-core')).default } catch {
    console.error('puppeteer-core absent : npm i --no-save puppeteer-core@25.8.0'); process.exit(2)
  }
})()

const nav = await puppeteer.launch({
  executablePath: trouverChrome(), headless: 'new',
  args: ['--headless=new', '--hide-scrollbars', '--mute-audio', '--window-size=1280,800',
    '--use-angle=d3d11', '--enable-gpu', '--ignore-gpu-blocklist', '--disable-dev-shm-usage'],
})
const page = await nav.newPage()
await page.setViewport({ width: 1280, height: 800, deviceScaleFactor: 1 })
page.on('pageerror', (e) => console.error('  [page] ' + e.message))

const b64url = (o) => Buffer.from(JSON.stringify(o), 'utf8').toString('base64')
  .replace(/\+/g, '-').replace(/\//g, '_').replace(/=+$/, '')
const [lat, lon, zoom] = LIEU.split(',').map(Number)
const url = `http://localhost:${PORT}/?${ADRESSE}#s=` + b64url({ loc: { lat, lon, zoom } })
console.log('→ ' + url)
await page.goto(url, { waitUntil: 'load', timeout: 90000 })
await page.waitForFunction('window.__exp && window.__exp.globe', { timeout: 90000 })
await new Promise((r) => setTimeout(r, 6000))
await page.keyboard.press('Escape')
await new Promise((r) => setTimeout(r, 12000))

const CADRE = { x: 340, y: 130, width: 620, height: 340 }

async function poserAltitude(m) {
  await page.evaluate((cible) => {
    const e = window.__exp, cam = e.camera, ct = e.controls
    ct.minDistance = 1e-4; ct.maxDistance = 1e12
    const t = ct.target, dir = cam.position.clone().sub(t).normalize()
    for (let i = 0; i < 40; i++) {
      const a = e.altitudeCadrageM()
      if (!Number.isFinite(a) || a <= 0) break
      const d = cam.position.distanceTo(t), nd = d * (cible / a)
      if (!Number.isFinite(nd) || nd <= 0) break
      cam.position.copy(t).addScaledVector(dir, nd)
      ct.update?.()
      if (Math.abs(e.altitudeCadrageM() - cible) / cible < 0.004) break
    }
  }, m)
  await new Promise((r) => setTimeout(r, 6000))
}

/** L'écart moyen par pixel entre DEUX captures d'un état identique. */
async function plancher() {
  // ⚠️ Une image entière passe après tout changement d'état : la première
  // capture qui suit une bascule attrape la transition, pas l'état.
  await new Promise((r) => setTimeout(r, 700))
  const a = 'data:image/png;base64,' + await page.screenshot({ clip: CADRE, encoding: 'base64' })
  await new Promise((r) => setTimeout(r, 700))
  const b = 'data:image/png;base64,' + await page.screenshot({ clip: CADRE, encoding: 'base64' })
  return page.evaluate(async (deux) => {
    const lire = async (u) => {
      const i = new Image()
      await new Promise((r, j) => { i.onload = r; i.onerror = j; i.src = u })
      const c = document.createElement('canvas')
      c.width = i.width; c.height = i.height
      c.getContext('2d').drawImage(i, 0, 0)
      return c.getContext('2d').getImageData(0, 0, c.width, c.height).data
    }
    const [x, y] = [await lire(deux[0]), await lire(deux[1])]
    let s = 0, n = 0, bouges = 0
    for (let p = 0; p < x.length; p += 4) {
      const d = (Math.abs(x[p] - y[p]) + Math.abs(x[p + 1] - y[p + 1]) + Math.abs(x[p + 2] - y[p + 2])) / 3
      s += d; n++
      if (d > 8) bouges++
    }
    return { ecart: +(s / n).toFixed(3), partBougee: +(bouges / n).toFixed(4) }
  }, [a, b])
}

const releves = []
for (const m of PALIERS) {
  await poserAltitude(m)
  await page.evaluate(() => { window.__exp.params.animations = true })
  const etat = await page.evaluate(() => {
    const e = window.__exp
    const nu = e.clouds && e.clouds.group
    const w = e.realWater && (e.realWater.mesh || e.realWater.group)
    return {
      altitude: Math.round(e.altitudeCadrageM()),
      crop: !!(e.veilleCrop && e.veilleCrop.pose),
      tuiles: e.globe.tiles ? e.globe.tiles.size : null,
      // ⚡ LA VALEUR RÉELLE, LUE DANS L'APPLICATION VIVANTE.
      paramsGrain: e.params.grain,
      animations: e.params.animations,
      nuagesVisibles: nu ? nu.visible : null,
      merVisible: w ? w.visible : null,
    }
  })
  etat.plancherAnimOn = (await plancher()).ecart
  await page.evaluate(() => { window.__exp.params.animations = false })
  etat.plancherAnimOff = (await plancher()).ecart
  releves.push(etat)
  console.log(
    `${String(etat.altitude).padStart(9)} m  crop=${etat.crop ? 'O' : '.'} n=${String(etat.tuiles).padStart(4)}  ` +
    `params.grain=${etat.paramsGrain}  nuages=${etat.nuagesVisibles}  mer=${etat.merVisible}  ` +
    `plancher : anims ON = ${etat.plancherAnimOn.toFixed(3)}   anims OFF = ${etat.plancherAnimOff.toFixed(3)}`)
}

if (SORTIE) {
  const f = path.resolve(RACINE, SORTIE)
  fs.mkdirSync(path.dirname(f), { recursive: true })
  fs.writeFileSync(f, JSON.stringify({ url, cadre: CADRE, quand: new Date().toISOString(), releves }, null, 2))
  console.log('→ ' + f)
}
await nav.close()
