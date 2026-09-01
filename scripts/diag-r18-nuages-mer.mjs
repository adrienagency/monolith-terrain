// DIAGNOSTIC R18 — pourquoi les nuages, la mer et le SSAO ne se voient pas.
//
// La sonde d'image dit « rien ne bouge », la sonde d'uniformes ne regarde que
// `globe.uniforms`. Ni l'une ni l'autre ne dit si l'OBJET existe dans la scène
// rendue. C'est ce que celle-ci relève : la présence, la visibilité, et les
// uniformes du matériau de la mer du crop — qui ne vivent pas sur le globe.
import fs from 'node:fs'
import path from 'node:path'
import { fileURLToPath } from 'node:url'

const RACINE = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..')
const args = process.argv.slice(2)
const opt = (n, d = null) => { const i = args.indexOf(n); return i >= 0 && args[i + 1] ? args[i + 1] : d }
const PORT = Number(opt('--port', '5561'))
const SORTIE = opt('--sortie', path.join(RACINE, '.banc/R18'))

function trouverChrome() {
  const p = ['C:/Program Files/Google/Chrome/Application/chrome.exe', 'C:/Program Files (x86)/Google/Chrome/Application/chrome.exe', '/usr/bin/google-chrome'].find((x) => fs.existsSync(x))
  if (!p) { console.error('Chrome introuvable'); process.exit(2) }
  return p
}
async function chargerPuppeteer() {
  for (const p of [path.join(RACINE, 'node_modules/puppeteer-core/lib/puppeteer/puppeteer-core.js'),
    'C:/Dev/wt-f3/node_modules/puppeteer-core/lib/puppeteer/puppeteer-core.js',
    'C:/Dev/wt-warm/node_modules/puppeteer-core/lib/puppeteer/puppeteer-core.js']) {
    if (fs.existsSync(p)) return (await import('file:///' + p.replace(/\\/g, '/'))).default
  }
  console.error('puppeteer-core introuvable'); process.exit(2)
}
const dodo = (ms) => new Promise((r) => setTimeout(r, ms))

const puppeteer = await chargerPuppeteer()
const nav = await puppeteer.launch({ executablePath: trouverChrome(), headless: true, args: ['--headless=new', '--no-sandbox', '--enable-unsafe-swiftshader', '--window-size=1280,900'] })
const out = {}
try {
  const page = await nav.newPage()
  await page.setViewport({ width: 1280, height: 800 })
  await page.evaluateOnNewDocument(() => { try { localStorage.setItem('shibumap-ui-advanced', '1'); localStorage.setItem('shibumap-workmode', 'studio') } catch {} })
  await page.goto(`http://localhost:${PORT}/`, { waitUntil: 'domcontentloaded', timeout: 120000 })
  await page.waitForFunction(() => window.__exp?.globe && window.__exp?.composer, { timeout: 90000, polling: 100 })
  await dodo(10000)
  await page.keyboard.press('Escape')
  await dodo(3000)

  // ① la scène RENDUE : quelles racines, et qui est visible
  out.scenes = await page.evaluate(() => {
    const e = window.__exp
    const decrire = (racine, nom) => {
      if (!racine) return { nom, absent: true }
      const l = []
      racine.traverse((o) => {
        if (!o.isMesh && !o.isPoints && !o.isLine && !o.isSprite) return
        let vis = o.visible, p = o.parent
        while (vis && p) { vis = p.visible; p = p.parent }
        l.push({ n: o.name || o.type, vis, mat: o.material?.type || '?' })
      })
      return { nom, total: l.length, visibles: l.filter((x) => x.vis).length, noms: [...new Set(l.filter((x) => x.vis).map((x) => x.n))].slice(0, 40) }
    }
    return [decrire(e.scene, 'scene (bloc)'), decrire(e.sceneGlobe, 'sceneGlobe')]
  })

  // ② les nuages : objet, parent, visibilité
  out.nuages = await page.evaluate(() => {
    const e = window.__exp
    const c = e.clouds
    const chemin = (o) => { const n = []; let p = o; while (p) { n.unshift(p.name || p.type); p = p.parent } return n.join('/') }
    const grp = c?.group || c?.mesh || c?.root || null
    return {
      cloudsEnabled: e.params.cloudsEnabled,
      cles: c ? Object.keys(c).slice(0, 24) : null,
      groupe: grp ? { visible: grp.visible, enfants: grp.children?.length ?? 0, chemin: chemin(grp), dansScene: !!grp.parent } : null,
      globeClouds: (() => {
        const g = e.globe
        for (const k of Object.keys(g || {})) if (/nuage|cloud/i.test(k)) return k
        return null
      })(),
    }
  })

  // ③ la mer du crop : le matériau, ses uniformes, et ce qu'une tirette y fait
  const merUniformes = () => page.evaluate(() => {
    const e = window.__exp
    const trouve = []
    const scan = (racine) => racine?.traverse?.((o) => {
      const u = o.material?.uniforms
      if (u && /mer|cloud|eau|water/i.test(o.name || '')) {
        const lu = {}
        for (const [k, v] of Object.entries(u)) {
          const val = v?.value
          if (typeof val === 'number') lu[k] = val
          else if (val?.getHexString) lu[k] = '#' + val.getHexString()
        }
        let vis = o.visible, p = o.parent
        while (vis && p) { vis = p.visible; p = p.parent }
        trouve.push({ nom: o.name || o.type, visible: vis, racine: racine === e.scene ? 'bloc' : 'globe', u: lu })
      }
    })
    scan(e.scene); scan(e.sceneGlobe)
    return trouve
  })
  out.merAvant = await merUniformes()
  await page.evaluate(() => {
    const e = window.__exp
    e.params.seaWaveH = 2
    e.params.seaChop = 1
    e.params.seaSpeed = 2
    e.realWater?.setWaves({ height: 2, choppiness: 1, speed: 2 })
  })
  await dodo(2500)
  out.merApres = await merUniformes()

  // ④ le SSAO
  out.ssao = await page.evaluate(() => {
    const e = window.__exp
    return {
      ssaoEnabled: e.params.ssaoEnabled,
      aoTierOk: e.params._aoTierOk,
      passes: e.composer?.passes?.map((p) => p.constructor?.name + (p.enabled ? '' : ' (off)')) ?? null,
    }
  })
  await page.screenshot({ path: path.join(SORTIE, 'diag-nuages-mer.png') })
} finally {
  await nav.close()
  fs.mkdirSync(SORTIE, { recursive: true })
  fs.writeFileSync(path.join(SORTIE, 'diag-nuages-mer.json'), JSON.stringify(out, null, 1))
  console.log(JSON.stringify(out, null, 1).slice(0, 7000))
}
