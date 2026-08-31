// SONDE OVERPASS — Tâche D16-b, étape 4 : CE QUE COÛTE UNE EMPRISE, PAR ZOOM.
//
// `OSM_MIN_ZOOM = 12` (`src/map/water-layer.js`) a une raison écrite, et elle
// porte des chiffres de 2026. Cette sonde les REJOUE depuis la page vivante,
// par le MÊME chemin que le calque (`fetchOverpassLines` / `fetchOverpassAreas`,
// donc le même `maxsize`, le même point d'accès, le même navigateur).
//
// ⛔ **ELLE NE DESCEND PAS SOUS z10, ET C'EST DÉLIBÉRÉ.** Le point d'accès est
// le service public gratuit `overpass-api.de`, appelé par IP de visiteur. Une
// emprise z8 couvre SEIZE FOIS la surface d'une z10 ; la mesurer, c'est
// demander à un service gratuit de balayer un pays entier pour produire un
// chiffre qu'on peut déduire. Le §« LE DAMIER » de `water-layer.js` le dit
// déjà : multiplier les emprises sur une source publique est « un risque de
// bannissement qui couperait le calque pour TOUT LE MONDE ».
//
// EMPLOI  node scripts/sonde-overpass.mjs --zooms 12,11,10

import fs from 'node:fs'
import path from 'node:path'
import { fileURLToPath } from 'node:url'

const RACINE = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..')
const arg = (n, d = null) => { const i = process.argv.indexOf(n); return i >= 0 && process.argv[i + 1] ? process.argv[i + 1] : d }
const PORT = arg('--port', '5543')
const ZOOMS = arg('--zooms', '12,11,10').split(',').map(Number)
const PLANCHER = 10 // voir l'en-tête : on ne descend pas plus bas sur un service public

function trouverChrome() {
  const donne = arg('--chrome', process.env.CHROME_PATH)
  if (donne) return donne
  const pistes = ['C:/Program Files/Google/Chrome/Application/chrome.exe', 'C:/Program Files (x86)/Google/Chrome/Application/chrome.exe', '/usr/bin/google-chrome']
  const t = pistes.find((p) => fs.existsSync(p))
  if (!t) { console.error('Chrome introuvable'); process.exit(2) }
  return t
}
async function chargerPuppeteer() {
  for (const p of [path.join(RACINE, 'node_modules/puppeteer-core/lib/puppeteer/puppeteer-core.js'),
    'C:/Dev/wt-f3/node_modules/puppeteer-core/lib/puppeteer/puppeteer-core.js']) {
    if (fs.existsSync(p)) return (await import('file:///' + p.split('\\').join('/'))).default
  }
  console.error('puppeteer-core introuvable'); process.exit(2)
}

const dodo = (ms) => new Promise((r) => setTimeout(r, ms))
const SORTIE = path.join(RACINE, '.banc', 'D16b')
fs.mkdirSync(SORTIE, { recursive: true })

const puppeteer = await chargerPuppeteer()
const nav = await puppeteer.launch({ executablePath: trouverChrome(), headless: true,
  args: ['--headless=new', '--no-sandbox', '--enable-unsafe-swiftshader', '--window-size=1280,900'] })
const releve = { quand: new Date().toISOString(), lignes: [] }
try {
  const page = await nav.newPage()
  await page.setViewport({ width: 1280, height: 800 })
  await page.goto(`http://localhost:${PORT}/`, { waitUntil: 'domcontentloaded', timeout: 120000 })
  await page.waitForFunction(() => window.__exp?.mapLayers, { timeout: 90000, polling: 100 })
  await dodo(4000)
  // l'octet compté à la source : on écoute le réseau, pas une estimation
  await page.evaluate(() => {
    window.__ovp = { octets: 0 }
    const f = window.fetch
    window.fetch = async (...a) => {
      const r = await f(...a)
      if (String(a[0]).includes('overpass')) {
        const c = r.clone(); c.arrayBuffer().then((b) => { window.__ovp.octets += b.byteLength }).catch(() => {})
      }
      return r
    }
  })
  for (const z of ZOOMS) {
    if (z < PLANCHER) { console.log(`z${z} — SAUTÉ, voir l'en-tête de la sonde`); continue }
    const l = await page.evaluate(async (zoom) => {
      const [{ empriseBlocMNT }, ovp] = await Promise.all([import('/src/geo.js'), import('/src/map/overpass.js')])
      const e = empriseBlocMNT({ lat: 45.9237, lon: 6.8694, zoom })
      const bounds = { minLat: e.sud, maxLat: e.nord, minLon: e.ouest, maxLon: e.est }
      window.__ovp.octets = 0
      const t0 = performance.now()
      const feats = await ovp.fetchOverpassLines(bounds, 'water')
      const tLignes = performance.now() - t0
      const t1 = performance.now()
      const areas = await ovp.fetchOverpassAreas(bounds)
      const tAires = performance.now() - t1
      const kmLon = 111.32 * Math.cos(45.9237 * Math.PI / 180) * (((e.est - e.ouest) + 360) % 360)
      return {
        zoom, largeurKm: Math.round(kmLon),
        msLignes: Math.round(tLignes), msAires: Math.round(tAires),
        ways: feats ? feats.length : null, aires: areas ? areas.length : null,
        Mo: Math.round((window.__ovp.octets / 1048576) * 10) / 10,
      }
    }, z)
    releve.lignes.push(l)
    console.log(`z${l.zoom} · ${l.largeurKm} km · lignes ${l.ways ?? 'REFUS'} en ${l.msLignes} ms · aires ${l.aires ?? 'REFUS'} en ${l.msAires} ms · ${l.Mo} Mo`)
    await dodo(8000) // on espace : le point d'accès est public et gratuit
  }
} finally {
  await nav.close()
  const f = path.join(SORTIE, 'overpass.json')
  fs.writeFileSync(f, JSON.stringify(releve, null, 1), 'utf8')
  console.log('→', f)
}
