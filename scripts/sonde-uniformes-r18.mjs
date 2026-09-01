// SONDE UNIFORMES R18 — ce que le contrôle FAIT ARRIVER JUSQU'AU GLOBE.
//
// La sonde d'image dit « l'écran ne bouge pas ». Elle ne dit pas POURQUOI :
// la valeur n'a pas traversé, ou elle a traversé et ne se voit pas. Les deux
// appellent des réparations opposées, d'où cet instrument.
//
// Elle bouge le contrôle par son VRAI nœud DOM (même chemin que la sonde
// d'image) et compare, avant/après, les uniformes scalaires et couleurs de
// `globe.uniforms` ET de `terrain.mapUniforms`.
import fs from 'node:fs'
import path from 'node:path'
import { fileURLToPath } from 'node:url'

const RACINE = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..')
const args = process.argv.slice(2)
const opt = (n, d = null) => { const i = args.indexOf(n); return i >= 0 && args[i + 1] ? args[i + 1] : d }
const PORT = Number(opt('--port', '5561'))
const SORTIE = opt('--sortie', path.join(RACINE, '.banc/R18'))
const CIBLES = (opt('--cibles', '') || '').split(',').filter(Boolean).map(Number)
const REPOS = Number(opt('--repos', '1500'))

function trouverChrome() {
  const pistes = ['C:/Program Files/Google/Chrome/Application/chrome.exe', 'C:/Program Files (x86)/Google/Chrome/Application/chrome.exe', '/usr/bin/google-chrome']
  const t = pistes.find((p) => fs.existsSync(p))
  if (!t) { console.error('Chrome introuvable'); process.exit(2) }
  return t
}
async function chargerPuppeteer() {
  const pistes = [
    path.join(RACINE, 'node_modules/puppeteer-core/lib/puppeteer/puppeteer-core.js'),
    'C:/Dev/wt-f3/node_modules/puppeteer-core/lib/puppeteer/puppeteer-core.js',
    'C:/Dev/wt-warm/node_modules/puppeteer-core/lib/puppeteer/puppeteer-core.js',
  ]
  for (const p of pistes) if (fs.existsSync(p)) return (await import('file:///' + p.replace(/\\/g, '/'))).default
  console.error('puppeteer-core introuvable'); process.exit(2)
}
const dodo = (ms) => new Promise((r) => setTimeout(r, ms))

// ⚠️ MÊME CONSTRUCTEUR DE CIBLES QUE LA SONDE D'IMAGE — copié volontairement :
// les deux instruments doivent numéroter les contrôles À L'IDENTIQUE, sinon la
// jointure des deux tableaux compare deux options différentes.
const poserCibles = (await import('file:///' + path.join(RACINE, 'scripts/cibles-studio-r18.mjs').replace(/\\/g, '/'))).poserCibles

const puppeteer = await chargerPuppeteer()
const nav = await puppeteer.launch({
  executablePath: trouverChrome(), headless: true,
  args: ['--headless=new', '--no-sandbox', '--enable-unsafe-swiftshader', '--window-size=1280,900'],
})
const sortie = { port: PORT, lignes: [] }
try {
  const page = await nav.newPage()
  await page.setViewport({ width: 1280, height: 800 })
  await page.evaluateOnNewDocument(() => {
    try { localStorage.setItem('shibumap-ui-advanced', '1'); localStorage.setItem('shibumap-workmode', 'studio') } catch {}
  })
  await page.goto(`http://localhost:${PORT}/`, { waitUntil: 'domcontentloaded', timeout: 120000 })
  await page.waitForFunction(() => window.__exp?.globe && window.__exp?.composer, { timeout: 90000, polling: 100 })
  await dodo(9000)
  await page.keyboard.press('Escape')
  await dodo(2500)
  await page.evaluate(() => {
    for (const p of document.querySelectorAll('.ce-panel')) p.classList.remove('collapsed')
    for (const s of document.querySelectorAll('.ce-section')) s.classList.add('open')
    window.__r18 = { cibles: [] }
  })
  const liste = await page.evaluate(poserCibles)
  // l'instantané : tout ce qui se compare par une valeur
  const instantane = () => page.evaluate(() => {
    const lire = (u) => {
      const o = {}
      for (const [k, v] of Object.entries(u || {})) {
        const val = v?.value
        if (typeof val === 'number') o[k] = val
        else if (val && typeof val.getHexString === 'function') o[k] = '#' + val.getHexString()
        else if (val && typeof val.x === 'number') o[k] = [val.x, val.y, val.z ?? null, val.w ?? null].filter((x) => x !== null).join(',')
        else if (typeof val === 'boolean') o[k] = val
      }
      return o
    }
    return { globe: lire(window.__exp.globe?.uniforms), socle: lire(window.__exp.terrain?.mapUniforms) }
  })
  const diff = (a, b) => {
    const out = []
    for (const k of Object.keys(b)) if (String(a[k]) !== String(b[k])) out.push(`${k}: ${a[k]} → ${b[k]}`)
    return out
  }
  const cibles = CIBLES.length ? CIBLES : liste.map((c) => c.i)
  for (const i of cibles) {
    const c = liste[i]
    if (!c) continue
    const a = await instantane()
    const pose = await page.evaluate((idx) => {
      try { return String(window.__r18.cibles[idx].apply(0)) } catch (er) { return 'ERR ' + er.message }
    }, i)
    await dodo(REPOS)
    const b1 = await instantane()
    const pose2 = await page.evaluate((idx) => {
      try { return String(window.__r18.cibles[idx].apply(1)) } catch (er) { return 'ERR ' + er.message }
    }, i)
    await dodo(REPOS)
    const b2 = await instantane()
    await page.evaluate((idx) => { try { window.__r18.cibles[idx].apply(2) } catch {} }, i)
    await dodo(REPOS)
    const ligne = {
      i, panneau: c.panneau, section: c.section, nom: c.nom, type: c.type, pose: [pose, pose2],
      globe: [...new Set([...diff(a.globe, b1.globe), ...diff(b1.globe, b2.globe)].map((s) => s.split(':')[0]))],
      socle: [...new Set([...diff(a.socle, b1.socle), ...diff(b1.socle, b2.socle)].map((s) => s.split(':')[0]))],
      globeDetail: diff(a.globe, b2.globe).slice(0, 12),
    }
    sortie.lignes.push(ligne)
    console.log(`[${i}] ${c.panneau} › ${c.nom} — globe: ${ligne.globe.join(' ') || '(RIEN)'} | socle: ${ligne.socle.length}`)
  }
} finally {
  await nav.close()
  fs.mkdirSync(SORTIE, { recursive: true })
  const f = path.join(SORTIE, 'uniformes-' + Date.now() + '.json')
  fs.writeFileSync(f, JSON.stringify(sortie, null, 1))
  console.log('écrit :', f)
}
