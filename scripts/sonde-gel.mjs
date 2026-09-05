// SONDE GEL — « le logiciel se fige à z7 » : reproduire le gel, et attraper la
// pile du fil principal PENDANT qu'il est figé.
//
//   node scripts/sonde-gel.mjs --port 10577 --etiq base [--n 8] [--lat -4.4349 --lon 121.7735 --z 7]
//
// Par chargement : page neuve → orbite (12 000 km) → `modes.flyTo(lat, lon, z)`
// → observation `--duree` ms. Dans la page : `PerformanceObserver` (longtask) +
// un compteur d'images. HORS page : un chien de garde (`Runtime.evaluate` avec
// délai via la session CDP). Si le fil ne répond plus pendant `--gel` ms, on
// envoie `Debugger.pause` (V8 l'honore par interruption, même dans une boucle
// infinie) et on note les `callFrames` : c'est la ligne qui gèle.
import fs from 'node:fs'
import path from 'node:path'
import { fileURLToPath } from 'node:url'

const RACINE = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..')
const A = process.argv.slice(2)
const opt = (n, d = null) => { const i = A.indexOf(n); return i >= 0 && A[i + 1] !== undefined ? A[i + 1] : d }
const PORT = Number(opt('--port', '10577'))
const ETIQ = opt('--etiq', 'base')
const N = Number(opt('--n', '8'))
const LAT = Number(opt('--lat', '-4.4349'))
const LON = Number(opt('--lon', '121.7735'))
const Z = Number(opt('--z', '7'))
const DUREE = Number(opt('--duree', '30000'))
const GEL_MS = Number(opt('--gel', '4000'))
const THROTTLE = Number(opt('--cpu', '1'))
// `--chemin molette` : le chemin de la vidéo d'Adrien — surface à z5, puis deux
// crans de molette (`modes.cranZoom(1)`), Z6 puis Z7. `--chemin vol` : flyTo direct.
const CHEMIN = opt('--chemin', 'molette')
const Z_DEPART = Number(opt('--zdepart', '5'))
const DPR = Number(opt('--dpr', '1'))
const PROFIL = opt('--profil', '0') !== '0'
// la fenêtre d'observation APRÈS l'arrivée à z (ms) : l'épreuve de réponse part à sa fin
const APRES_MS = Number(opt('--apres', '15000'))
const SOURIS = opt('--souris', '1') !== '0' // le pointeur se promène sur la carte, comme dans la vidéo
const SORTIE = opt('--sortie', path.join(RACINE, '.banc', 'GEL', ETIQ))
const dodo = (ms) => new Promise((r) => setTimeout(r, ms))

function trouverChrome() {
  const d = opt('--chrome', process.env.CHROME_PATH)
  if (d) return d
  const t = ['C:/Program Files/Google/Chrome/Application/chrome.exe', 'C:/Program Files (x86)/Google/Chrome/Application/chrome.exe'].find((p) => fs.existsSync(p))
  if (!t) { console.error('Chrome introuvable'); process.exit(2) }
  return t
}
async function chargerPuppeteer() {
  for (const p of [
    path.join(RACINE, 'node_modules/puppeteer-core/lib/puppeteer/puppeteer-core.js'),
    'C:/Dev/wt-cote2/node_modules/puppeteer-core/lib/puppeteer/puppeteer-core.js',
    'C:/Dev/shibumap-site/node_modules/puppeteer-core/lib/puppeteer/puppeteer-core.js',
  ]) if (fs.existsSync(p)) return (await import('file:///' + p.split('\\').join('/'))).default
  console.error('puppeteer-core introuvable'); process.exit(2)
}

const INSTRUMENTER = () => {
  const G = (window.__gel = { longtasks: [], images: 0, t0: performance.now(), erreurs: [] })
  try {
    new PerformanceObserver((l) => {
      for (const t of l.getEntries()) G.longtasks.push({ debut: Math.round(t.startTime), ms: +t.duration.toFixed(1) })
    }).observe({ entryTypes: ['longtask'] })
  } catch (e) { G.longtaskErr = String(e) }
  // les trous entre deux images (> 100 ms) : c'est ce que l'œil appelle un gel
  G.trous = []
  let tPrec = performance.now()
  const tic = (t) => { G.images++; if (t - tPrec > 100) G.trous.push({ t: Math.round(tPrec), ms: Math.round(t - tPrec) }); tPrec = t; requestAnimationFrame(tic) }
  requestAnimationFrame(tic)
  window.addEventListener('error', (e) => G.erreurs.push(String(e.message).slice(0, 200)))
  // ── LES ENVELOPPES : qui prend le fil, et combien, sur le chemin de descente ──
  G.env = []
  const e = window.__exp
  const enveloppe = (obj, nom, etiq) => {
    if (!obj || typeof obj[nom] !== 'function') return
    const brut = obj[nom]
    obj[nom] = function (...a) {
      const t0 = performance.now()
      try { return brut.apply(this, a) } finally {
        const ms = performance.now() - t0
        if (ms >= 20) G.env.push({ t: Math.round(t0), ms: +ms.toFixed(1), f: etiq || nom, z: e.params.demZoom })
      }
    }
  }
  for (const n of ['rebuild', 'rafraichirFenetre', '_ecrireRelief', 'rebuildRoughness', 'loadSurface', 'setDem', 'regenerate', 'applyParams']) enveloppe(e.terrain, n, 'terrain.' + n)
  for (const n of ['update', '_buildMesh', 'poserCrop', 'construireParoisCrop', 'tuilesAvecHauteurs', '_traverse', 'setVisible', '_rechargeTuiles', 'animerMer']) enveloppe(e.globe, n, 'globe.' + n)
  for (const n of ['rebuild', 'update']) enveloppe(e.plinth, n, 'plinth.' + n)
  for (const n of ['update']) enveloppe(e.clouds, n, 'clouds.' + n)
  for (const n of ['update', '_rescale', '_refine']) enveloppe(e.modes, n, 'modes.' + n)
  for (const n of ['loadSurface', 'reserverHauteurs', 'hauteursDeFlux']) enveloppe(e.modes.hooks, n, 'hooks.' + n)
  for (const n of ['loadRealTerrain', 'regenerateTerrain', 'applyBackground', 'applyPalette']) enveloppe(e, n, 'exp.' + n)
  for (const n of ['render']) enveloppe(e.composer, n, 'composer.' + n)
  for (const n of ['render', 'compile']) enveloppe(e.renderer, n, 'renderer.' + n)
  // ── LES NUANCEURS : quand un programme est lié, et combien coûte le premier
  // `getProgramParameter` (c'est lui qui attend la compilation du pilote) ──
  G.programmes = []
  try {
    const gl = e.renderer.getContext()
    for (const n of ['linkProgram', 'getProgramParameter', 'getProgramInfoLog', 'getShaderParameter', 'compileShader']) {
      const brut = gl[n]
      gl[n] = function (...a) {
        const t0 = performance.now()
        const r = brut.apply(this, a)
        const ms = performance.now() - t0
        if (ms >= 5) G.env.push({ t: Math.round(t0), ms: +ms.toFixed(1), f: 'gl.' + n, z: e.params.demZoom })
        return r
      }
    }
  } catch (err) { G.erreurs.push('gl hook: ' + err.message) }
  G.listeProgrammes = () => (e.renderer.info.programs || []).map((p) => `${p.name}#${p.id}`)
}

fs.mkdirSync(SORTIE, { recursive: true })
const puppeteer = await chargerPuppeteer()
const nav = await puppeteer.launch({
  executablePath: trouverChrome(), headless: true,
  args: ['--headless=new', '--no-sandbox', '--window-size=1280,720', '--autoplay-policy=no-user-gesture-required'],
})
import { execSync } from 'node:child_process'
const commit = (() => { try { return execSync('git rev-parse --short HEAD', { cwd: RACINE }).toString().trim() } catch { return null } })()
const bilan = { etiq: ETIQ, port: PORT, lieu: [LAT, LON, Z], cpu: THROTTLE, date: new Date().toISOString(), chargements: [] }

try {
  for (let i = 0; i < N; i++) {
    const page = await nav.newPage()
    await page.setViewport({ width: 1280, height: 720, deviceScaleFactor: DPR })
    const cdp = await page.target().createCDPSession()
    if (THROTTLE > 1) await cdp.send('Emulation.setCPUThrottlingRate', { rate: THROTTLE })
    await cdp.send('Debugger.enable')
    const erreursPage = []
    page.on('pageerror', (e) => erreursPage.push('pageerror: ' + String(e.message).slice(0, 300)))
    page.on('console', (m) => { if (m.type() === 'error' || m.type() === 'warning') erreursPage.push(m.type() + ': ' + m.text().slice(0, 300)) })
    page.on('response', (r) => { if (r.status() >= 400) erreursPage.push(`http ${r.status()} ${r.url().slice(-90)}`) })
    const c = { i, gel: false, pile: null, plusLongue: 0, longtasks: [], zServi: null, mode: null, erreurs: [] }
    bilan.chargements.push(c)
    let paused = null
    cdp.on('Debugger.paused', (p) => { paused = p })

    await page.goto(`http://127.0.0.1:${PORT}/`, { waitUntil: 'domcontentloaded', timeout: 90000 })
    await page.waitForFunction(() => window.__exp?.modes && window.__exp?.globe && window.__exp?.composer, { timeout: 90000, polling: 100 })
    await page.evaluate(INSTRUMENTER)
    let profil = null
    if (PROFIL) {
      await cdp.send('Profiler.enable'); await cdp.send('Profiler.setSamplingInterval', { interval: 500 })
      await cdp.send('Profiler.start')
      const now = await page.evaluate(() => performance.now())
      profil = { nowDebut: now }
      c.profilNowDebut = now
    }
    await page.evaluate(async () => { const e = window.__exp; if (e.modes.mode !== 'orbital') await e.modes.enterOrbit(12e6) })
    await dodo(4000)
    await page.keyboard.press('Escape').catch(() => {})
    const tDebut = Date.now()
    // le vol, sans attendre sa promesse (c'est elle qui peut geler)
    if (CHEMIN === 'vol') {
      page.evaluate((lat, lon, z) => { window.__exp.modes.flyTo(lat, lon, z).catch((e) => window.__gel.erreurs.push('flyTo: ' + e.message)) }, LAT, LON, Z).catch(() => {})
    } else if (CHEMIN === 'orbite') {
      // le chemin de la vidéo : l'orbite centrée sur le lieu, puis la molette
      // cran après cran (×√2 chacun) jusqu'à ce que le cartouche dise Z7
      page.evaluate(async (lat, lon, z, pasMs) => {
        const e = window.__exp, m = e.modes
        const dodo = (ms) => new Promise((r) => setTimeout(r, ms))
        window.__gel.crans = []
        try {
          // l'orbite centrée sur le lieu : la caméra sur la verticale (même
          // convention que `latLonToSphere` : pose au sol puis vol… on passe par
          // la surface à z3, puis on remonte à 12 000 km, ce qui garde lat/lon)
          if (m.mode !== 'orbital') await m.enterOrbit(12e6)
          await dodo(300)
          await m.flyTo(lat, lon, 3)
          await dodo(1500)
          await m.enterOrbit(12e6)
          await dodo(2500)
          for (let k = 0; k < 60; k++) {
            m.cranZoom(1)
            window.__gel.crans.push({ t: Math.round(performance.now()), mode: m.mode, z: e.params.demZoom, busy: !!m.busy })
            await dodo(pasMs)
            if (m.mode === 'surface' && e.params.demZoom >= z) break
          }
          // ── L'ÉPREUVE DE RÉPONSE : le logiciel répond-il encore, 6 s après ? ──
          await dodo(6000)
          const etat = () => ({ t: Math.round(performance.now()), busy: !!m.busy, travel: !!m.travel, dive: !!m._diveTween, z: e.params.demZoom, mode: m.mode, dist: +m.controls.getDistance().toFixed(3), lvl: +(m._levelZoom ?? 0).toFixed(3) })
          const avant = etat()
          m.cranZoom(1)
          await dodo(6000)
          const apres = etat()
          window.__gel.reponse = { avant, apres, repond: apres.z !== avant.z || apres.dist !== avant.dist }
        } catch (err) { window.__gel.erreurs.push('chemin: ' + err.message) }
      }, LAT, LON, Z, Number(opt('--pas', '600'))).catch(() => {})
    } else if (CHEMIN === 'roulette') {
      // la VRAIE molette : des `WheelEvent` sur la toile (deltaY −100, tous les
      // `--pas` ms), depuis l'orbite centrée sur le lieu, jusqu'à Z7 puis 6 s de
      // plus, puis l'épreuve de réponse (un cran de plus, la caméra bouge-t-elle ?)
      page.evaluate(async (lat, lon, z, pasMs, nMax, apresMs) => {
        const e = window.__exp, m = e.modes
        const toile = e.renderer.domElement
        const dodo = (ms) => new Promise((r) => setTimeout(r, ms))
        const roule = (dy) => toile.dispatchEvent(new WheelEvent('wheel', { deltaY: dy, deltaMode: 0, clientX: 640, clientY: 360, bubbles: true, cancelable: true }))
        window.__gel.crans = []
        try {
          if (m.mode !== 'orbital') await m.enterOrbit(12e6)
          await dodo(300)
          await m.flyTo(lat, lon, 3)
          await dodo(1500)
          await m.enterOrbit(12e6)
          await dodo(2500)
          for (let k = 0; k < nMax; k++) {
            roule(-100)
            window.__gel.crans.push({ t: Math.round(performance.now()), mode: m.mode, z: e.params.demZoom, busy: !!m.busy, lvl: +(m._levelZoom ?? 0).toFixed(2) })
            await dodo(pasMs)
            if (m.mode === 'surface' && e.params.demZoom >= z) break
          }
          window.__gel.arrive = Math.round(performance.now())
          await dodo(apresMs)
          const etat = () => ({ t: Math.round(performance.now()), busy: !!m.busy, travel: !!m.travel, dive: !!m._diveTween, z: e.params.demZoom, mode: m.mode, dist: +m.controls.getDistance().toFixed(3), lvl: +(m._levelZoom ?? 0).toFixed(3) })
          const avant = etat()
          roule(-100); roule(-100); roule(-100)
          await dodo(6000)
          const apres = etat()
          window.__gel.reponse = { avant, apres, repond: apres.z !== avant.z || apres.dist !== avant.dist }
        } catch (err) { window.__gel.erreurs.push('chemin: ' + err.message) }
      }, LAT, LON, Z, Number(opt('--pas', '120')), Number(opt('--nmax', '400')), APRES_MS).catch(() => {})
    } else {
      page.evaluate(async (lat, lon, z0, z) => {
        const m = window.__exp.modes
        const dodo = (ms) => new Promise((r) => setTimeout(r, ms))
        try {
          await m.flyTo(lat, lon, z0)
          await dodo(6000)
          for (let k = z0; k < z; k++) { m.cranZoom(1); await dodo(5000) }
        } catch (e) { window.__gel.erreurs.push('chemin: ' + e.message) }
      }, LAT, LON, Z_DEPART, Z).catch(() => {})
    }
    let dernierePonse = Date.now()
    let dernier = null
    let pas = 0
    while (Date.now() - tDebut < DUREE) {
      await dodo(250)
      if (SOURIS) { pas++; page.mouse.move(500 + 200 * Math.sin(pas / 5), 330 + 100 * Math.cos(pas / 7)).catch(() => {}) }
      let rep = null
      try {
        rep = await Promise.race([
          cdp.send('Runtime.evaluate', { expression: 'JSON.stringify({im: __gel.images, lt: __gel.longtasks.length, z: __exp.params.demZoom, mode: __exp.modes.mode, heapMo: Math.round((performance.memory?.usedJSHeapSize||0)/1048576), tuiles: __exp.globe.tiles.size, fini: !!__gel.reponse, prog: (__exp.renderer.info.programs||[]).length})', returnByValue: true }),
          dodo(GEL_MS).then(() => null),
        ])
      } catch (e) { rep = { err: String(e.message) } }
      if (rep && rep.result) { dernierePonse = Date.now(); dernier = JSON.parse(rep.result.value); (c.trace ||= []).push({ t: Date.now() - tDebut, ...dernier }); if (dernier.fini) break; continue }
      if (rep && rep.err) { c.erreurs.push(rep.err); continue }
      // ── LE FIL NE RÉPOND PLUS ──────────────────────────────────────────────
      c.gel = true
      c.gelApresMs = Date.now() - tDebut
      c.dernierEtat = dernier
      console.log(`  [${i}] GEL après ${c.gelApresMs} ms — dernier état`, JSON.stringify(dernier))
      paused = null
      cdp.send('Debugger.pause').catch((e) => c.erreurs.push('pause: ' + e.message))
      const tp = Date.now()
      while (!paused && Date.now() - tp < 8000) await dodo(100)
      if (paused) {
        c.pile = paused.callFrames.slice(0, 25).map((f) => `${f.functionName || '(anon)'} @ ${f.url.replace(/^.*\/\/[^/]+/, '')}:${f.location.lineNumber + 1}:${f.location.columnNumber + 1}`)
        c.raisonPause = paused.reason
        console.log('  pile :\n    ' + c.pile.join('\n    '))
        // deuxième pause 1,5 s plus tard pour voir si on bouge dans la même boucle
        await cdp.send('Debugger.resume').catch(() => {})
        await dodo(1500)
        paused = null
        cdp.send('Debugger.pause').catch(() => {})
        const t2 = Date.now()
        while (!paused && Date.now() - t2 < 8000) await dodo(100)
        if (paused) {
          c.pile2 = paused.callFrames.slice(0, 25).map((f) => `${f.functionName || '(anon)'} @ ${f.url.replace(/^.*\/\/[^/]+/, '')}:${f.location.lineNumber + 1}:${f.location.columnNumber + 1}`)
          console.log('  pile 1,5 s plus tard :\n    ' + c.pile2.join('\n    '))
          // variables locales du cadre du haut
          try {
            const sc = paused.callFrames[0].scopeChain.find((s) => s.type === 'local')
            if (sc) {
              const props = await cdp.send('Runtime.getProperties', { objectId: sc.object.objectId, ownProperties: true })
              c.locales = props.result.slice(0, 40).map((p) => `${p.name}=${p.value ? (p.value.value !== undefined ? JSON.stringify(p.value.value) : p.value.description) : '?'}`.slice(0, 120))
              console.log('  locales : ' + c.locales.join(' | '))
            }
          } catch (e) { c.erreurs.push('locales: ' + e.message) }
          await cdp.send('Debugger.resume').catch(() => {})
        }
      } else c.erreurs.push('Debugger.pause sans réponse')
      break
    }
    if (!c.gel && profil) {
      const { profile } = await cdp.send('Profiler.stop')
      fs.writeFileSync(path.join(SORTIE, `charg-${i}.cpuprofile`), JSON.stringify(profile))
      // alignement : startTime (µs, horloge monotone) ↔ performance.now() lu juste après le start
      const noeuds = new Map(profile.nodes.map((n) => [n.id, n]))
      let t = profil.nowDebut // le profil démarre à l'instant où performance.now() valait nowDebut
      const echantillons = []
      for (let k = 0; k < profile.samples.length; k++) { t += profile.timeDeltas[k] / 1000; echantillons.push({ t: t, id: profile.samples[k] }) }
      // t est maintenant en ms sur l'horloge de performance.now()
      profil.attribuer = (debut, fin) => {
        const self = new Map()
        const pile = new Map()
        let n = 0
        for (const s of echantillons) {
          if (s.t < debut || s.t > fin) continue
          n++
          const nd = noeuds.get(s.id)
          const nom = `${nd.callFrame.functionName || '(anon)'} ${nd.callFrame.url.replace(/^.*\/src\//, '')}:${nd.callFrame.lineNumber + 1}`
          self.set(nom, (self.get(nom) || 0) + 1)
          // les ancêtres (pour voir l'appelant de la tâche)
          let p = nd
          const vus = new Set()
          while (p && p.parent != null) { p = noeuds.get(p.parent); if (!p) break; const nn = p.callFrame.functionName || '(anon)'; if (!vus.has(nn)) { vus.add(nn); pile.set(nn, (pile.get(nn) || 0) + 1) } }
        }
        const top = (m) => [...m.entries()].sort((a, b) => b[1] - a[1]).slice(0, 8).map(([k, v]) => `${k} ${Math.round((100 * v) / Math.max(1, n))}%`)
        return { n, self: top(self), pile: top(pile) }
      }
      // parent pointers
      for (const nd of profile.nodes) for (const ch of nd.children || []) noeuds.get(ch).parent = nd.id
    }
    if (!c.gel) {
      const d = await page.evaluate(() => ({ lt: window.__gel.longtasks, im: window.__gel.images, z: window.__exp.params.demZoom, mode: window.__exp.modes.mode, err: window.__gel.erreurs, crans: window.__gel.crans || null, reponse: window.__gel.reponse || null }))
      c.crans = d.crans; c.reponse = d.reponse
      if (d.reponse) console.log('  réponse au cran après arrivée :', JSON.stringify(d.reponse))
      c.longtasksTous = d.lt.slice()
      c.trous = await page.evaluate(() => window.__gel.trous)
      c.programmes = await page.evaluate(() => window.__gel.listeProgrammes())
      c.longtasks = d.lt.sort((a, b) => b.ms - a.ms).slice(0, 8)
      c.env = await page.evaluate(() => window.__gel.env)
      // pour chacune des 3 plus longues tâches, les enveloppes qui tombent dedans
      for (const lt of c.longtasks.slice(0, 3)) {
        const dedans = c.env.filter((x) => x.t >= lt.debut - 5 && x.t <= lt.debut + lt.ms).sort((a, b) => b.ms - a.ms).slice(0, 6)
        console.log(`    tâche ${lt.ms} ms @${lt.debut} :`, dedans.map((x) => `${x.f} ${x.ms} (z${x.z})`).join(', ') || '(aucune enveloppe)')
        if (profil) { const a = profil.attribuer(lt.debut, lt.debut + lt.ms); lt.profil = a; console.log(`      profil (${a.n} éch.) self : ${a.self.join(' · ')}
      appelants : ${a.pile.join(' · ')}`) }
      }
      c.plusLongue = c.longtasks[0]?.ms ?? 0
      c.images = d.im; c.zServi = d.z; c.mode = d.mode; c.erreurs.push(...d.err)
      c.etatFin = await page.evaluate(() => { const g = window.__exp.globe; return { crop: g._crop ? { ...g._crop } : null, zCible: g._zCropCible, zServi: g._zCropServi, parois: !!g._parois, tuiles: g.tiles.size, file: g.queue?.length ?? null, vol: g.inFlight ?? null, garde: g.gardeHauteurs?.size ?? null, dem: !!window.__exp.terrain?.dem } }).catch((e) => String(e))
      console.log('  état final :', JSON.stringify(c.etatFin))
      console.log(`  [${i}] sans gel — plus longue tâche ${c.plusLongue} ms, ${d.lt.length} tâches > 50 ms, images ${d.im}, demZoom ${d.z}, mode ${d.mode}`)
    }
    c.erreurs.push(...erreursPage)
    if (erreursPage.length) console.log('  console/erreurs :', erreursPage.slice(0, 6).join(' || '))
    try { await page.screenshot({ path: path.join(SORTIE, `charg-${i}.png`) }) } catch {}
    await page.close().catch(() => {})
  }
} finally {
  await nav.close().catch(() => {})
}
bilan.commit = commit
bilan.gels = bilan.chargements.filter((c) => c.gel).length
bilan.plusLongue = Math.max(0, ...bilan.chargements.map((c) => c.plusLongue))
fs.writeFileSync(path.join(SORTIE, 'bilan.json'), JSON.stringify(bilan, null, 2))
console.log(`\n${ETIQ} : ${bilan.gels}/${N} gels, plus longue tâche (sans gel) ${bilan.plusLongue} ms → ${SORTIE}`)
