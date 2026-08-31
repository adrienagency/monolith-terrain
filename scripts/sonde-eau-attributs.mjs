// LES ATTRIBUTS QUE LE GPU DEMANDE VRAIMENT — Tâche R14, vérification.
//
// ⚠️ **« LA NORMALE N'ÉTAIT PAS DE LA VRAM » EST UNE AFFIRMATION, PAS UNE
// MESURE**, tant qu'on ne l'a pas lue. three.js ne lie un attribut de géométrie
// que s'il figure dans les attributs ACTIFS du programme compilé
// (`WebGLBindingStates.setupVertexAttributes` boucle sur `program.getAttributes()`),
// et c'est cette liaison qui déclenche le téléversement. Ce script lit donc,
// pour les DEUX matériaux de remplissage vivants du calque d'eau, la liste que
// leur programme réclame.
//
// EMPLOI  npm run dev -- --port 5553 --strictPort
//         node scripts/sonde-eau-attributs.mjs

import fs from 'node:fs'
import path from 'node:path'
import { fileURLToPath } from 'node:url'

const RACINE = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..')
const A = process.argv.slice(2)
const opt = (n, d = null) => { const i = A.indexOf(n); return i >= 0 && A[i + 1] ? A[i + 1] : d }
const PORT = opt('--port', '5553')

function trouverChrome() {
  const donne = opt('--chrome', process.env.CHROME_PATH)
  if (donne) return donne
  const pistes = ['C:/Program Files/Google/Chrome/Application/chrome.exe', 'C:/Program Files (x86)/Google/Chrome/Application/chrome.exe', '/usr/bin/google-chrome']
  const t = pistes.find((p) => fs.existsSync(p))
  if (!t) { console.error('Chrome introuvable'); process.exit(2) }
  return t
}
async function chargerPuppeteer() {
  try { return (await import('puppeteer-core')).default } catch { /* voisins */ }
  for (const p of [path.join(RACINE, 'node_modules/puppeteer-core/lib/puppeteer/puppeteer-core.js'),
    'C:/Dev/wt-f3/node_modules/puppeteer-core/lib/puppeteer/puppeteer-core.js']) {
    if (fs.existsSync(p)) return (await import('file:///' + p.split(String.fromCharCode(92)).join('/'))).default
  }
  console.error('puppeteer-core introuvable'); process.exit(2)
}
const dodo = (ms) => new Promise((r) => setTimeout(r, ms))

const puppeteer = await chargerPuppeteer()
const nav = await puppeteer.launch({ executablePath: trouverChrome(), headless: true, args: ['--headless=new', '--no-sandbox', '--enable-unsafe-swiftshader', '--window-size=1280,900'] })
try {
  const page = await nav.newPage()
  await page.setViewport({ width: 1280, height: 800 })
  await page.goto(`http://localhost:${PORT}/`, { waitUntil: 'domcontentloaded', timeout: 120000 })
  await page.waitForFunction(() => window.__exp?.mapLayers && window.__exp?.globe, { timeout: 90000, polling: 100 })
  await dodo(6000)
  await page.keyboard.press('Escape')
  await page.evaluate(async () => { await window.__exp.modes.flyTo(45.9237, 6.8694, 6) })
  await dodo(12000)
  await page.evaluate(() => window.__exp.rebuildMapLayers())
  await dodo(6000)
  const out = await page.evaluate(() => {
    const e = window.__exp
    const rendu = e.renderer
    const res = []
    e.mapLayers.water.group.traverse((o) => {
      if (!o.isMesh) return
      const prog = rendu.properties.get(o.material)?.currentProgram
      res.push({
        materiau: o.material.type,
        ordre: o.renderOrder,
        sommets: o.geometry.attributes.position?.count ?? 0,
        attributsGeometrie: Object.keys(o.geometry.attributes).sort(),
        attributsDemandes: prog ? Object.keys(prog.getAttributes()).sort() : '(programme non compilé)',
      })
    })
    return res
  })
  for (const r of out) console.log(`${r.materiau} (ordre ${r.ordre}, ${r.sommets} sommets)\n   géométrie porte : ${r.attributsGeometrie.join(', ')}\n   programme demande : ${Array.isArray(r.attributsDemandes) ? r.attributsDemandes.join(', ') : r.attributsDemandes}`)
} finally {
  await nav.close()
}
