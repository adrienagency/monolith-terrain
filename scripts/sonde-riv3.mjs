// SONDE RIV 3 — ATTRIBUER LE LAG, ET PAYER LE PREMIER CONTACT OVERPASS.
//
// Deux choses que RIV-2 ne pouvait pas rendre :
//
// ① LE PREMIER CONTACT. Le disjoncteur d'`overpass.js` (OVERPASS_PANNE_MS
//    60 s) s'ouvre dès le premier abandon. Une sonde qui laisse l'application
//    se poser 6 s avant de voler mesure une branche Overpass DÉJÀ COUPÉE, donc
//    gratuite. On instrumente ici AVANT la pose de démarrage.
//
// ② L'ATTRIBUTION. Une tâche longue de 1 627 ms dans la fenêtre de chargement
//    n'est pas forcément celle du calque d'eau : le globe maille ses tuiles en
//    même temps. On croise donc chaque tâche longue avec l'intervalle de la
//    reconstruction, ET on fait un A/B rivières allumées / éteintes DANS LA
//    MÊME SESSION (le pixel n'est déterministe qu'en orbite ; ailleurs, A/B).
import fs from 'node:fs'
import path from 'node:path'
import { fileURLToPath } from 'node:url'

const RACINE = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..')
const A = process.argv.slice(2)
const opt = (n, d = null) => { const i = A.indexOf(n); return i >= 0 && A[i + 1] ? A[i + 1] : d }
const PORT = opt('--port', '7241')
const TOURS = Number(opt('--tours', '3'))

function trouverChrome() {
  const d = opt('--chrome', process.env.CHROME_PATH); if (d) return d
  const p = ['C:/Program Files/Google/Chrome/Application/chrome.exe',
    'C:/Program Files (x86)/Google/Chrome/Application/chrome.exe', '/usr/bin/google-chrome'].find((x) => fs.existsSync(x))
  if (!p) { console.error('Chrome introuvable'); process.exit(2) } return p
}
async function chargerPuppeteer() {
  try { return (await import('puppeteer-core')).default } catch { /* voisins */ }
  for (const p of [path.join(RACINE, 'node_modules/puppeteer-core/lib/puppeteer/puppeteer-core.js'),
    'C:/Dev/wt-f3/node_modules/puppeteer-core/lib/puppeteer/puppeteer-core.js',
    'C:/Dev/monolith-terrain/node_modules/puppeteer-core/lib/puppeteer/puppeteer-core.js']) {
    if (fs.existsSync(p)) return (await import('file:///' + p.split(String.fromCharCode(92)).join('/'))).default
  }
  console.error('puppeteer-core introuvable'); process.exit(2)
}
const dodo = (ms) => new Promise((r) => setTimeout(r, ms))
const r1 = (v) => (v == null ? null : Math.round(v * 10) / 10)
const med = (a) => { if (!a.length) return null; const s = [...a].sort((x, y) => x - y); return s.length % 2 ? s[s.length >> 1] : (s[(s.length >> 1) - 1] + s[s.length >> 1]) / 2 }

const INSTRUMENT = () => {
  if (window.__riv) return
  window.__riv = { entrees: [], taches: [], images: [] }
  try {
    new PerformanceObserver((l) => { for (const e of l.getEntries()) window.__riv.taches.push({ d: e.duration, t: e.startTime }) })
      .observe({ entryTypes: ['longtask'] })
  } catch { window.__riv.pasDeLongtask = true }
  let last = performance.now()
  const f = () => { const n = performance.now(); window.__riv.images.push({ d: n - last, t: n }); last = n; requestAnimationFrame(f) }
  requestAnimationFrame(f)
  const eau = window.__exp.mapLayers.water
  const vrai = eau.rebuild.bind(eau)
  eau.rebuild = async function (ctx) {
    const e = { t0: performance.now(), t1: null, chrono: null, sommets: 0, objets: 0, osm: false }
    window.__riv.entrees.push(e)
    try { return await vrai(ctx) } finally {
      e.t1 = performance.now(); e.chrono = eau.chrono; e.osm = eau.usingOsm
      let s = 0, o = 0
      eau.group.traverse((x) => {
        const g = x.geometry; if (!g) return; o++
        if (x.isLineSegments2 || x.isLine2) s += g.attributes.instanceStart ? g.attributes.instanceStart.count * 2 : 0
        else if (x.isMesh) s += g.attributes.position ? g.attributes.position.count : 0
      })
      e.sommets = s; e.objets = o
    }
  }
}
const VIDE = () => { window.__riv.entrees.length = 0; window.__riv.taches.length = 0; window.__riv.images.length = 0 }
const RECOLTE = () => {
  const im = window.__riv.images.map((x) => x.d).sort((a, b) => a - b)
  const t = window.__riv.taches
  return {
    entrees: window.__riv.entrees.map((x) => ({ ...x })), taches: [...t],
    bloque: t.reduce((s, x) => s + x.d, 0), plusLongue: t.length ? Math.max(...t.map((x) => x.d)) : 0, nbTaches: t.length,
    p50: im.length ? im[im.length >> 1] : null, p99: im.length ? im[Math.floor(im.length * 0.99)] : null,
    pire: im.length ? im[im.length - 1] : null, nbImages: im.length,
  }
}
// part des tâches longues qui TOMBE DANS une reconstruction du calque d'eau
function attribue(r) {
  let dans = 0
  for (const t of r.taches) {
    const a = t.t, b = t.t + t.d
    for (const e of r.entrees) {
      if (e.t1 == null) continue
      const o = Math.min(b, e.t1) - Math.max(a, e.t0)
      if (o > 0) { dans += o; break }
    }
  }
  return dans
}

const SORTIE = path.join(RACINE, '.banc', 'RIV')
fs.mkdirSync(SORTIE, { recursive: true })
const puppeteer = await chargerPuppeteer()
const nav = await puppeteer.launch({
  executablePath: trouverChrome(), headless: true,
  args: ['--headless=new', '--no-sandbox', '--enable-unsafe-swiftshader', '--window-size=1280,900'],
})
const out = { quand: new Date().toISOString(), premierContact: null, ab: [] }
try {
  const page = await nav.newPage()
  await page.setViewport({ width: 1280, height: 800 })
  page.on('console', (m) => { if (m.type() === 'error') { const t = m.text(); if (!/404/.test(t)) console.log('  [page]', t.slice(0, 120)) } })
  const cdp = await page.target().createCDPSession()
  await cdp.send('Network.enable')
  const reqs = new Map(); let fini = []
  cdp.on('Network.requestWillBeSent', (e) => reqs.set(e.requestId, { url: e.request.url, t0: e.timestamp * 1000 }))
  cdp.on('Network.loadingFinished', (e) => { const r = reqs.get(e.requestId); if (r) { r.ms = e.timestamp * 1000 - r.t0; r.octets = e.encodedDataLength; fini.push(r) } })
  cdp.on('Network.loadingFailed', (e) => { const r = reqs.get(e.requestId); if (r) { r.ms = e.timestamp * 1000 - r.t0; r.octets = 0; r.echec = e.errorText; fini.push(r) } })

  // ══════ ① PREMIER CONTACT — instrumenté AVANT la pose de démarrage ═══════
  await page.goto(`http://127.0.0.1:${PORT}/`, { waitUntil: 'domcontentloaded', timeout: 120000 })
  await page.waitForFunction(() => window.__exp?.mapLayers?.water, { timeout: 90000, polling: 20 })
  await page.evaluate(INSTRUMENT)
  fini = []
  await page.evaluate(() => { window.__exp.params.waterEnabled = true })
  // on vole tout de suite en zoom OSM : le disjoncteur est encore fermé
  await page.evaluate(() => { try { window.__exp.modes.flyTo(45.764, 4.8357, 13) } catch {} })
  await dodo(30000)
  const pc = await page.evaluate(RECOLTE)
  const op = fini.filter((r) => /overpass/.test(r.url))
  out.premierContact = {
    rebuilds: pc.entrees.length,
    detail: pc.entrees.map((e) => ({ mur: r1(e.t1 - e.t0), chrono: e.chrono, sommets: e.sommets, objets: e.objets, osm: e.osm })),
    plusLongueTache: r1(pc.plusLongue), bloque: r1(pc.bloque), nbTaches: pc.nbTaches,
    tachesDansEau: r1(attribue(pc)),
    p50: r1(pc.p50), p99: r1(pc.p99), pire: r1(pc.pire),
    overpass: op.map((r) => ({ ms: r1(r.ms), echec: r.echec ?? null, octets: r.octets })),
  }
  console.log('── PREMIER CONTACT (page neuve, vol immédiat Rhône z13) ──')
  console.log(JSON.stringify(out.premierContact, null, 1))

  // ══════ ② A/B RIVIÈRES ALLUMÉES / ÉTEINTES, MÊME SESSION ═════════════════
  await page.keyboard.press('Escape'); await dodo(1000)
  await page.evaluate(() => { window.__exp.params.animations = false })
  for (const cas of [{ nom: 'Rhone', lat: 45.764, lon: 4.8357, z: 11 }, { nom: 'Rhone', lat: 45.764, lon: 4.8357, z: 13 }]) {
    const on = [], off = []
    for (let i = 0; i < TOURS; i++) {
      for (const eau of [true, false]) {
        // on repart d'ailleurs à chaque fois pour repayer un vrai chargement
        await page.evaluate(() => { window.__exp.modes.flyTo(0, 0, 4) }); await dodo(6000)
        await page.evaluate((v) => { window.__exp.params.waterEnabled = v; window.__riv.entrees.length = 0; window.__riv.taches.length = 0; window.__riv.images.length = 0 }, eau)
        await page.evaluate((a) => { window.__exp.modes.flyTo(a.lat, a.lon, a.z) }, cas)
        await dodo(18000)
        const r = await page.evaluate(RECOLTE)
        const ligne = {
          plusLongue: r.plusLongue, bloque: r.bloque, nbTaches: r.nbTaches, p99: r.p99, pire: r.pire,
          murEau: r.entrees.reduce((s, e) => s + (e.t1 - e.t0), 0), rebuilds: r.entrees.length,
          sommets: Math.max(0, ...r.entrees.map((e) => e.sommets)),
          tachesDansEau: attribue(r),
        }
          ; (eau ? on : off).push(ligne)
      }
    }
    const mm = (a, k) => r1(med(a.map((x) => x[k])))
    const l = {
      cas: `${cas.nom} z${cas.z}`, tours: TOURS,
      on: { plusLongue: mm(on, 'plusLongue'), bloque: mm(on, 'bloque'), p99: mm(on, 'p99'), pire: mm(on, 'pire'), murEau: mm(on, 'murEau'), rebuilds: mm(on, 'rebuilds'), sommets: mm(on, 'sommets'), tachesDansEau: mm(on, 'tachesDansEau') },
      off: { plusLongue: mm(off, 'plusLongue'), bloque: mm(off, 'bloque'), p99: mm(off, 'p99'), pire: mm(off, 'pire'), murEau: mm(off, 'murEau'), rebuilds: mm(off, 'rebuilds') },
    }
    l.delta = { plusLongue: r1(l.on.plusLongue - l.off.plusLongue), bloque: r1(l.on.bloque - l.off.bloque), p99: r1(l.on.p99 - l.off.p99), pire: r1(l.on.pire - l.off.pire) }
    out.ab.push(l)
    console.log(`\n── A/B ${l.cas} (médiane de ${TOURS}) ──`)
    console.log(' rivières ON :', JSON.stringify(l.on))
    console.log(' rivières OFF:', JSON.stringify(l.off))
    console.log(' écart imputable à l\'eau :', JSON.stringify(l.delta))
  }
} finally {
  await nav.close()
  const f = path.join(SORTIE, 'riv-attribution.json')
  fs.writeFileSync(f, JSON.stringify(out, null, 1), 'utf8')
  console.log('→', f)
}
