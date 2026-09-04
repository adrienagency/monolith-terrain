// SONDE RIV 2 — LE LAG DES RIVIÈRES À FROID.
//
// ⚠️ POURQUOI CETTE SECONDE SONDE. La première (`sonde-riv.mjs`) mesurait la
// DEUXIÈME reconstruction : le module Overpass mémorise par emprise ET ouvre un
// disjoncteur de 60 s après un abandon (`overpass.js` : `_cache`,
// `OVERPASS_PANNE_MS`). Une reconstruction relancée après 12 s de repos ne
// repaie donc NI le réseau NI l'attente — elle rend 20 à 120 ms et fait croire
// que tout va bien. Le lag qu'Adrien ressent est celui de la PREMIÈRE arrivée.
// On recharge donc la page pour CHAQUE cas, et on instrumente AVANT le vol.
//
// ⚠️ Le réseau est lu au protocole CDP, et retenu PAR ORDRE D'ARRIVÉE, pas par
// horodatage : `Network.requestWillBeSent.timestamp` est une horloge monotone
// d'origine arbitraire, elle ne se compare pas à `performance.timeOrigin`.
// (C'est l'erreur qui rendait « 0 requête » au premier tour.)
import fs from 'node:fs'
import path from 'node:path'
import { fileURLToPath } from 'node:url'

const RACINE = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..')
const A = process.argv.slice(2)
const opt = (n, d = null) => { const i = A.indexOf(n); return i >= 0 && A[i + 1] ? A[i + 1] : d }
const PORT = opt('--port', '7241')
const OBS = Number(opt('--obs', '22000')) // fenêtre d'observation après le vol

const LIEUX = [
  { nom: 'Rhone',       lat: 45.7640, lon: 4.8357 },
  { nom: 'Mississippi', lat: 29.5000, lon: -89.6000 },
  { nom: 'Sahara',      lat: 23.5000, lon: 13.0000 },
]
const ZOOMS = [11, 13]

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
const pct = (a, b) => (b > 0 ? Math.round((a / b) * 1000) / 10 : 0)

// Le code injecté AVANT le vol : compteurs de reconstruction, tâches longues,
// temps d'image. On enveloppe l'objet vivant — `src/` n'est pas touché.
const INSTRUMENT = () => {
  window.__riv = { entrees: [], taches: [], images: [] }
  try {
    new PerformanceObserver((l) => { for (const e of l.getEntries()) window.__riv.taches.push({ d: e.duration, t: e.startTime }) })
      .observe({ entryTypes: ['longtask'] })
  } catch { window.__riv.pasDeLongtask = true }
  let last = performance.now()
  const f = () => { const n = performance.now(); window.__riv.images.push(n - last); last = n; requestAnimationFrame(f) }
  requestAnimationFrame(f)
  const eau = window.__exp.mapLayers.water
  const vrai = eau.rebuild.bind(eau)
  eau.rebuild = async function (ctx) {
    const e = { t0: performance.now(), t1: null, chrono: null, abandon: false, sommets: 0, objets: 0 }
    window.__riv.entrees.push(e)
    const idAvant = eau._buildId + 1 // celui que CETTE entrée va prendre
    try { return await vrai(ctx) } finally {
      e.t1 = performance.now()
      e.abandon = eau._buildId !== idAvant
      e.chrono = eau.chrono
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

const SORTIE = path.join(RACINE, '.banc', 'RIV')
fs.mkdirSync(SORTIE, { recursive: true })
const puppeteer = await chargerPuppeteer()
const nav = await puppeteer.launch({
  executablePath: trouverChrome(), headless: true,
  args: ['--headless=new', '--no-sandbox', '--enable-unsafe-swiftshader', '--window-size=1280,900'],
})
const releve = { quand: new Date().toISOString(), port: PORT, lignes: [], mouvement: null }
try {
  const page = await nav.newPage()
  await page.setViewport({ width: 1280, height: 800 })
  page.on('console', (m) => { if (m.type() === 'error') { const t = m.text(); if (!/404/.test(t)) console.log('  [page]', t.slice(0, 130)) } })
  const cdp = await page.target().createCDPSession()
  await cdp.send('Network.enable')
  const reqs = new Map()
  let fini = []
  cdp.on('Network.requestWillBeSent', (e) => reqs.set(e.requestId, { url: e.request.url, t0: e.timestamp * 1000 }))
  cdp.on('Network.loadingFinished', (e) => { const r = reqs.get(e.requestId); if (r) { r.ms = e.timestamp * 1000 - r.t0; r.octets = e.encodedDataLength; fini.push(r) } })
  cdp.on('Network.loadingFailed', (e) => { const r = reqs.get(e.requestId); if (r) { r.ms = e.timestamp * 1000 - r.t0; r.octets = 0; r.echec = e.errorText; fini.push(r) } })

  const EAU = /overpass|\/data\/map\/|\/tuiles-eau|\/water|\/lac|lake|river/i

  for (const lieu of LIEUX) {
    for (const z of ZOOMS) {
      // ── PAGE NEUVE : cache de module, disjoncteur Overpass, tout à froid ──
      await page.goto(`http://127.0.0.1:${PORT}/`, { waitUntil: 'domcontentloaded', timeout: 120000 })
      await page.waitForFunction(() => window.__exp?.mapLayers?.water && window.__exp?.modes, { timeout: 90000, polling: 50 })
      await dodo(6000)
      await page.keyboard.press('Escape')
      await dodo(1200)
      await page.evaluate(() => { window.__exp.params.animations = false; window.__exp.params.waterEnabled = true })
      await page.evaluate(INSTRUMENT)
      fini = []

      await page.evaluate((a) => { window.__exp.modes.flyTo(a.lat, a.lon, a.z) }, { lat: lieu.lat, lon: lieu.lon, z })
      await dodo(OBS)

      const d = await page.evaluate(() => {
        const e = window.__exp
        const im = [...window.__riv.images].sort((x, y) => x - y)
        return {
          entrees: window.__riv.entrees.map((x) => ({ ...x })),
          taches: [...window.__riv.taches], images: im,
          zoom: e.params.demZoom, usingOsm: e.mapLayers.water.usingOsm,
          tas: performance.memory ? performance.memory.usedJSHeapSize : null,
          geos: e.renderer.info.memory.geometries,
        }
      })

      // La reconstruction la plus COÛTEUSE de la fenêtre — celle qu'on subit
      const abouties = d.entrees.filter((x) => x.t1 != null)
      const pire = abouties.slice().sort((a, b) => (b.t1 - b.t0) - (a.t1 - a.t0))[0] ?? null
      const somme = abouties.reduce((s, x) => s + (x.t1 - x.t0), 0)
      const c = pire?.chrono ?? {}
      const geometrie = (c.projection || 0) + (c.decoupe || 0) + (c.traits || 0) + (c.triangulation || 0) + (c.drapage || 0) + (c.fusion || 0)
      const murPire = pire ? pire.t1 - pire.t0 : 0
      // Le fil principal n'est occupé QUE par ce que chronoEau compte ; le reste
      // du mur de la reconstruction est de l'ATTENTE (réseau, microtâches).
      const attente = Math.max(0, murPire - (c.total || 0))
      const decodage = Math.max(0, (c.sources || 0) - 0) // sources = décodage + découpe, l'attente réseau est HORS chrono (await)
      const taches = d.taches
      const plusLongue = taches.length ? Math.max(...taches.map((t) => t.d)) : 0
      const bloque = taches.reduce((s, t) => s + t.d, 0)
      const im = d.images
      const q = (x) => (im.length ? r1(im[Math.min(im.length - 1, Math.floor(im.length * x))]) : null)

      const eauReq = fini.filter((r) => EAU.test(r.url))
      const l = {
        lieu: lieu.nom, zoomDemande: z, zoom: d.zoom, usingOsm: d.usingOsm,
        rebuildsEntres: d.entrees.length, rebuildsAbandonnes: abouties.filter((x) => x.abandon).length,
        murPire: r1(murPire), murCumule: r1(somme),
        attenteReseau: r1(attente), decodage: r1(decodage), geometrie: r1(geometrie),
        parts: { reseau: pct(attente, murPire), decodage: pct(decodage, murPire), geometrie: pct(geometrie, murPire) },
        chrono: Object.fromEntries(Object.entries(c).map(([k, v]) => [k, r1(v)])),
        sommets: pire?.sommets ?? 0, objets: pire?.objets ?? 0,
        plusLongueTache: r1(plusLongue), bloqueTotal: r1(bloque), nbTaches: taches.length,
        imageP50: q(0.5), imageP99: q(0.99), pireImage: r1(im[im.length - 1]), nbImages: im.length,
        reqTotal: fini.length, octetsTotal: fini.reduce((s, r) => s + (r.octets || 0), 0),
        reqEau: eauReq.length, octetsEau: eauReq.reduce((s, r) => s + (r.octets || 0), 0),
        echecs: fini.filter((r) => r.echec).length,
        lentes: fini.slice().sort((a, b) => b.ms - a.ms).slice(0, 5)
          .map((r) => ({ u: r.url.replace(/^https?:\/\/(127\.0\.0\.1:\d+)?/, '').slice(0, 64), ms: r1(r.ms), o: r.octets, echec: r.echec ?? null })),
        tas: d.tas, geos: d.geos,
      }
      releve.lignes.push(l)
      console.log(`${lieu.nom.padEnd(12)} z${String(l.zoom).padEnd(2)} osm=${String(l.usingOsm).padEnd(5)} · ${l.rebuildsEntres} rebuilds (${l.rebuildsAbandonnes} abandon) · PIRE ${String(l.murPire).padStart(7)} ms = attente ${String(l.parts.reseau).padStart(5)}% + decod ${String(l.parts.decodage).padStart(5)}% + geo ${String(l.parts.geometrie).padStart(5)}%`)
      console.log(`             +LONGUE TACHE ${String(l.plusLongueTache).padStart(6)} ms · bloque ${l.bloqueTotal} ms sur ${l.nbTaches} taches · image p50 ${l.imageP50} p99 ${l.imageP99} pire ${l.pireImage}`)
      console.log(`             ${l.sommets} sommets / ${l.objets} obj · reseau ${l.reqTotal} req ${(l.octetsTotal / 1048576).toFixed(2)} Mo (eau: ${l.reqEau} req ${(l.octetsEau / 1024).toFixed(0)} Ko, ${l.echecs} echecs)`)
      console.log(`             chrono ${Object.entries(l.chrono).map(([k, v]) => `${k}=${v}`).join(' ')}`)
      console.log(`             lentes ${JSON.stringify(l.lentes)}`)
    }
  }
} finally {
  await nav.close()
  const f = path.join(SORTIE, 'riv-froid.json')
  fs.writeFileSync(f, JSON.stringify(releve, null, 1), 'utf8')
  console.log('→', f)
}
