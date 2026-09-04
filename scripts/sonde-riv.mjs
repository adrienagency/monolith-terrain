// SONDE RIV — D'OÙ VIENT LE LAG DES RIVIÈRES.
//
// On ne mesure PAS avec getEntriesByType('resource') (plafond 250 entrées) :
// le réseau est lu au PROTOCOLE CDP (Network.requestWillBeSent /
// loadingFinished), qui ne plafonne pas et donne l'octet transféré.
//
// Postes rendus, par lieu × zoom :
//   · reseauAttente   — temps mur où AU MOINS une requête est en vol pendant
//                       la reconstruction (union des intervalles, pas la somme)
//   · sources         — chronoEau.sources (réseau + décodage + découpe emprise)
//   · decodage        — sources − reseauAttente (fil principal dans la phase
//                       de chargement : JSON.parse, clipToPatch, filterByZoom)
//   · geometrie       — projection + decoupe + traits + triangulation +
//                       drapage + fusion (chronoEau)
//   · bloque          — somme des Long Tasks pendant la reconstruction
//   · plusLongueTache — LA plus longue tâche unique, en ms. C'est elle qu'on sent.
//
// EMPLOI  npm run dev -- --host 127.0.0.1 --port 7241 --strictPort
//         node scripts/sonde-riv.mjs --port 7241
import fs from 'node:fs'
import path from 'node:path'
import { fileURLToPath } from 'node:url'

const RACINE = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..')
const A = process.argv.slice(2)
const opt = (n, d = null) => { const i = A.indexOf(n); return i >= 0 && A[i + 1] ? A[i + 1] : d }
const PORT = opt('--port', '7241')
const ETIQ = opt('--etiquette', 'riv')

const LIEUX = [
  { nom: 'Rhone',       lat: 45.7640, lon: 4.8357 },   // bassin dense (Lyon, confluence Rhône/Saône)
  { nom: 'Mississippi', lat: 29.5000, lon: -89.6000 }, // delta
  { nom: 'Sahara',      lat: 23.5000, lon: 13.0000 },  // désert : témoin « rien à charger »
]
const ZOOMS = [11, 13] // juste sous OSM_MIN_ZOOM=12, et bien au-dessus

function trouverChrome() {
  const donne = opt('--chrome', process.env.CHROME_PATH)
  if (donne) return donne
  const p = ['C:/Program Files/Google/Chrome/Application/chrome.exe',
    'C:/Program Files (x86)/Google/Chrome/Application/chrome.exe', '/usr/bin/google-chrome'].find((x) => fs.existsSync(x))
  if (!p) { console.error('Chrome introuvable'); process.exit(2) }
  return p
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
// union des intervalles [debut,fin] → temps mur couvert
function union(iv) {
  if (!iv.length) return 0
  const s = [...iv].sort((a, b) => a[0] - b[0])
  let tot = 0, d = s[0][0], f = s[0][1]
  for (const [a, b] of s.slice(1)) { if (a > f) { tot += f - d; d = a; f = b } else if (b > f) f = b }
  return tot + (f - d)
}

const SORTIE = path.join(RACINE, '.banc', 'RIV')
fs.mkdirSync(SORTIE, { recursive: true })
const puppeteer = await chargerPuppeteer()
const nav = await puppeteer.launch({
  executablePath: trouverChrome(), headless: true,
  args: ['--headless=new', '--no-sandbox', '--enable-unsafe-swiftshader', '--window-size=1280,900'],
})
const releve = { quand: new Date().toISOString(), etiquette: ETIQ, port: PORT, lignes: [], mouvement: null }
try {
  const page = await nav.newPage()
  await page.setViewport({ width: 1280, height: 800 })
  page.on('console', (m) => { if (m.type() === 'error') console.log('  [page]', m.text().slice(0, 140)) })

  // ── LE RÉSEAU AU PROTOCOLE CDP ────────────────────────────────────────────
  const cdp = await page.target().createCDPSession()
  await cdp.send('Network.enable')
  let reqs = new Map()   // id → {url, t0, t1, octets}
  let fini = []
  cdp.on('Network.requestWillBeSent', (e) => { reqs.set(e.requestId, { url: e.request.url, t0: e.timestamp * 1000, t1: null, octets: 0 }) })
  cdp.on('Network.loadingFinished', (e) => {
    const r = reqs.get(e.requestId); if (!r) return
    r.t1 = e.timestamp * 1000; r.octets = e.encodedDataLength; fini.push(r)
  })
  cdp.on('Network.loadingFailed', (e) => {
    const r = reqs.get(e.requestId); if (!r) return
    r.t1 = e.timestamp * 1000; r.echec = true; fini.push(r)
  })
  const resetReseau = () => { fini = [] }

  await page.goto(`http://127.0.0.1:${PORT}/`, { waitUntil: 'domcontentloaded', timeout: 120000 })
  await page.waitForFunction(() => window.__exp?.mapLayers && window.__exp?.rebuildMapLayers, { timeout: 90000, polling: 100 })
  await dodo(7000)
  await page.keyboard.press('Escape')
  await dodo(1500)
  await page.evaluate(() => { window.__exp.params.animations = false; window.__exp.params.waterEnabled = true })

  // Observateur de tâches longues + horloge commune (page ↔ CDP)
  await page.evaluate(() => {
    window.__riv = { taches: [], images: [], rebuilds: 0 }
    try {
      new PerformanceObserver((l) => { for (const e of l.getEntries()) window.__riv.taches.push({ d: e.duration, t: e.startTime }) })
        .observe({ entryTypes: ['longtask'] })
    } catch { window.__riv.pasDeLongtask = true }
    // temps d'image, en continu
    let last = performance.now()
    const f = () => { const n = performance.now(); window.__riv.images.push(n - last); last = n; requestAnimationFrame(f) }
    requestAnimationFrame(f)
    // compteur d'ENTRÉES dans la reconstruction du calque d'eau (pas de
    // modification de src/ : on enveloppe l'objet vivant)
    const eau = window.__exp.mapLayers.water
    const vrai = eau.rebuild.bind(eau)
    eau.rebuild = async (ctx) => { window.__riv.rebuilds++; return vrai(ctx) }
  })
  // décalage entre performance.now() de la page et le timestamp CDP (ms)
  const tOriginPage = await page.evaluate(() => performance.timeOrigin)

  for (const lieu of LIEUX) {
    for (const z of ZOOMS) {
      await page.evaluate(async (a) => { await window.__exp.modes.flyTo(a.lat, a.lon, a.z) }, { lat: lieu.lat, lon: lieu.lon, z })
      await dodo(12000)
      await page.evaluate(() => { window.__riv.taches.length = 0; window.__riv.images.length = 0 })
      resetReseau()

      const av = await page.evaluate(() => ({
        t0: performance.now() + performance.timeOrigin,
        tas: performance.memory ? performance.memory.usedJSHeapSize : null,
        geos: window.__exp.renderer.info.memory.geometries,
      }))
      // LA RECONSTRUCTION MESURÉE (froide : le cache HTTP de la zone peut être
      // chaud pour les tuiles de relief, mais les données d'eau de CE patch non)
      await page.evaluate(async () => { await window.__exp.rebuildMapLayers() })
      const ap = await page.evaluate(() => {
        const e = window.__exp, eau = e.mapLayers.water
        let sommetsTraits = 0, sommetsRemplis = 0, objets = 0, octets = 0
        const vus = new Set()
        eau.group.traverse((o) => {
          const g = o.geometry; if (!g) return
          objets++
          const c = (arr) => { if (!arr) return; const b = arr.buffer ?? arr; if (vus.has(b)) return; vus.add(b); octets += arr.byteLength }
          for (const n of Object.keys(g.attributes)) { const at = g.attributes[n]; c(at.isInterleavedBufferAttribute ? at.data.array : at.array) }
          if (g.index) c(g.index.array)
          if (o.isLineSegments2 || o.isLine2) sommetsTraits += g.attributes.instanceStart ? g.attributes.instanceStart.count * 2 : 0
          else if (o.isMesh) sommetsRemplis += g.attributes.position ? g.attributes.position.count : 0
        })
        return {
          t1: performance.now() + performance.timeOrigin,
          chrono: eau.chrono, usingOsm: eau.usingOsm, zoom: e.params.demZoom,
          taches: [...window.__riv.taches], images: [...window.__riv.images],
          tas: performance.memory ? performance.memory.usedJSHeapSize : null,
          geos: e.renderer.info.memory.geometries,
          objets, octets, sommetsTraits, sommetsRemplis,
        }
      })
      await dodo(600)

      // réseau retenu : les requêtes finies DANS la fenêtre de reconstruction
      const fenetre = fini.filter((r) => r.t1 != null && r.t1 >= av.t0 - 200 && r.t0 <= ap.t1 + 200)
      const iv = fenetre.map((r) => [Math.max(r.t0, av.t0), Math.min(r.t1, ap.t1)]).filter(([a, b]) => b > a)
      const reseauAttente = union(iv)
      const octetsReseau = fenetre.reduce((s, r) => s + (r.octets || 0), 0)

      const c = ap.chrono
      const geometrie = c.projection + c.decoupe + c.traits + c.triangulation + c.drapage + c.fusion
      const total = ap.t1 - av.t0
      const decodage = Math.max(0, c.sources - reseauAttente)
      const taches = ap.taches
      const plusLongue = taches.length ? Math.max(...taches.map((t) => t.d)) : 0
      const bloque = taches.reduce((s, t) => s + t.d, 0)
      const img = [...ap.images].sort((a, b) => a - b)
      const p = (q) => (img.length ? r1(img[Math.min(img.length - 1, Math.floor(img.length * q))]) : null)

      const l = {
        lieu: lieu.nom, zoomDemande: z, zoom: ap.zoom, usingOsm: ap.usingOsm,
        total: r1(total), sources: r1(c.sources), geometrie: r1(geometrie),
        reseauAttente: r1(reseauAttente), decodage: r1(decodage),
        chrono: Object.fromEntries(Object.entries(c).map(([k, v]) => [k, r1(v)])),
        parts: {
          reseau: pct(reseauAttente, total), decodage: pct(decodage, total),
          geometrie: pct(geometrie, total), reste: pct(total - reseauAttente - decodage - geometrie, total),
        },
        bloque: r1(bloque), partBloque: pct(bloque, total), plusLongueTache: r1(plusLongue),
        nbTaches: taches.length,
        requetes: fenetre.length, octetsReseau, echecs: fenetre.filter((r) => r.echec).length,
        urlsLentes: fenetre.slice().sort((a, b) => (b.t1 - b.t0) - (a.t1 - a.t0)).slice(0, 4)
          .map((r) => ({ u: r.url.replace(/^https?:\/\//, '').slice(0, 70), ms: r1(r.t1 - r.t0), o: r.octets })),
        imageP50: p(0.5), imageP99: p(0.99), nbImages: img.length,
        objets: ap.objets, octetsGeo: ap.octets, sommetsTraits: ap.sommetsTraits, sommetsRemplis: ap.sommetsRemplis,
        tasAvant: av.tas, tasApres: ap.tas, deltaTasMo: av.tas ? r1((ap.tas - av.tas) / 1048576) : null,
        geosAvant: av.geos, geosApres: ap.geos,
      }
      releve.lignes.push(l)
      console.log(`${lieu.nom.padEnd(12)} z${String(l.zoom).padEnd(2)} osm=${String(l.usingOsm).padEnd(5)} · total ${String(l.total).padStart(7)} ms · reseau ${String(l.parts.reseau).padStart(5)}% · decod ${String(l.parts.decodage).padStart(5)}% · geo ${String(l.parts.geometrie).padStart(5)}% · +LONGUE ${String(l.plusLongueTache).padStart(6)} ms · bloque ${String(l.bloque).padStart(6)} ms`)
      console.log(`              ${l.requetes} req / ${(l.octetsReseau / 1024).toFixed(0)} Ko (${l.echecs} échecs) · ${l.objets} obj · ${l.sommetsTraits} som.traits + ${l.sommetsRemplis} som.remplis · image p50 ${l.imageP50} / p99 ${l.imageP99} ms · tas ${l.deltaTasMo} Mo`)
      console.log(`              chrono ${Object.entries(l.chrono).map(([k, v]) => `${k}=${v}`).join(' ')}`)
    }
  }

  // ══════ ET QUAND ON BOUGE PENDANT LE CHARGEMENT ═════════════════════════
  // Une couche qui se reconstruit à chaque emprise coûte bien plus qu'un
  // chargement unique. On mesure : N déplacements courts sur le bassin dense,
  // combien de reconstructions ENTRENT, combien aboutissent, et le blocage.
  console.log('\n── mouvement pendant le chargement (Rhône z13) ──')
  await page.evaluate(async () => { await window.__exp.modes.flyTo(45.764, 4.8357, 13) })
  await dodo(12000)
  await page.evaluate(() => { window.__riv.taches.length = 0; window.__riv.images.length = 0; window.__riv.rebuilds = 0 })
  resetReseau()
  const mv0 = await page.evaluate(() => performance.now() + performance.timeOrigin)
  // six sauts de ~0,05° enchaînés sans attendre la fin — le geste réel
  await page.evaluate(async () => {
    const e = window.__exp
    const p = []
    for (let i = 0; i < 6; i++) {
      p.push(e.modes.flyTo(45.764 + i * 0.05, 4.8357 + i * 0.05, 13))
      await new Promise((r) => setTimeout(r, 700))
    }
    await Promise.allSettled(p)
  })
  await dodo(9000)
  const mv = await page.evaluate(() => {
    const im = [...window.__riv.images].sort((a, b) => a - b)
    const t = [...window.__riv.taches]
    return {
      t1: performance.now() + performance.timeOrigin,
      rebuilds: window.__riv.rebuilds, nbTaches: t.length,
      bloque: t.reduce((s, x) => s + x.d, 0), plusLongue: t.length ? Math.max(...t.map((x) => x.d)) : 0,
      imageP50: im.length ? im[im.length >> 1] : null, imageP99: im.length ? im[Math.floor(im.length * 0.99)] : null,
      pireImage: im.length ? im[im.length - 1] : null, nbImages: im.length,
      chrono: window.__exp.mapLayers.water.chrono,
    }
  })
  const fenMv = fini.filter((r) => r.t1 != null && r.t1 >= mv0 && r.t0 <= mv.t1)
  releve.mouvement = {
    dureeMs: r1(mv.t1 - mv0), rebuildsEntres: mv.rebuilds,
    bloque: r1(mv.bloque), partBloque: pct(mv.bloque, mv.t1 - mv0), plusLongueTache: r1(mv.plusLongue),
    nbTaches: mv.nbTaches, requetes: fenMv.length, octets: fenMv.reduce((s, r) => s + (r.octets || 0), 0),
    imageP50: r1(mv.imageP50), imageP99: r1(mv.imageP99), pireImage: r1(mv.pireImage), nbImages: mv.nbImages,
  }
  console.log(JSON.stringify(releve.mouvement, null, 1))
} finally {
  await nav.close()
  const f = path.join(SORTIE, `riv-${ETIQ}.json`)
  fs.writeFileSync(f, JSON.stringify(releve, null, 1), 'utf8')
  console.log('→', f)
}
