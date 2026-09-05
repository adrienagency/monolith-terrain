// SONDE GEL-2 — « le freeze arrive au DOUBLE-CLIC pour zoomer » (Adrien, 2026-09-05).
//
//   node scripts/sonde-gel2.mjs --port 11466 --etiq dc-gauche --lieu sulawesi --bouton gauche [--n 8] [--cpu 4] [--dpr 2] [--enchaine 1]
//
// Par chargement : page neuve → vol de présentation fini → voile fermé (vérifié :
// `elementFromPoint` = CANVAS) → `modes.flyTo` au lieu de départ → de VRAIS
// double-clics par CDP (`Input.dispatchMouseEvent`, clickCount 1 puis 2 — pas
// l'API), gauche (zoom vers le point) ou droit (dézoom), un par niveau ; avec
// `--enchaine 1`, le second double-clic part 250 ms après le premier (pendant la
// course du premier). HORS page : un chien de garde (`Runtime.evaluate` à délai)
// et `Debugger.pause` armé pour rendre la PILE du fil bloqué. À la fin, D19 :
// le point cliqué est-il resté sous son pixel (dérive en px), le rapport
// d'altitude, la rotation d'azimut ; puis l'épreuve de réponse (un double-clic
// de plus : la caméra bouge-t-elle ? `busy` est-il retombé ?).
import fs from 'node:fs'
import path from 'node:path'
import { fileURLToPath } from 'node:url'
import { execSync } from 'node:child_process'

const RACINE = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..')
const A = process.argv.slice(2)
const opt = (n, d = null) => { const i = A.indexOf(n); return i >= 0 && A[i + 1] !== undefined ? A[i + 1] : d }
const PORT = Number(opt('--port', '11466'))
const ETIQ = opt('--etiq', 'dc')
const N = Number(opt('--n', '8'))
const LIEU = opt('--lieu', 'sulawesi')
const BOUTON = opt('--bouton', 'gauche') // gauche = zoom avant ×2 par double-clic ; droit = ÷2
const ENCHAINE = opt('--enchaine', '0') !== '0'
// `--seq ggdd` : la suite des double-clics (g = gauche, d = droit) ; `--mesure 2` :
// l'index à partir duquel D19 se mesure (l'état « avant » est relu à cet index).
// Sans `--seq`, c'est `--bouton` répété `--niveaux` fois.
const SEQ = (opt('--seq', null) || (BOUTON === 'gauche' ? 'g' : 'd').repeat(Number(opt('--niveaux', '2')))).split('')
const MESURE = Number(opt('--mesure', '0'))
const NIVEAUX = Number(opt('--niveaux', '2')) // z5 → z7 : deux niveaux (en orbite : le maximum, on s'arrête à `--zfin`)
const Z_FIN = Number(opt('--zfin', '7'))
const THROTTLE = Number(opt('--cpu', '1'))
const DPR = Number(opt('--dpr', '1'))
// la fenêtre : 1280 × 720 par défaut ; `--w 2560 --h 1440 --dpr 2` = les 14,7 Mpx de l'iMac 5K d'Adrien
const W = Number(opt('--w', '1280')), H = Number(opt('--h', '720'))
const GEL_MS = Number(opt('--gel', '4000'))
const APRES_MS = Number(opt('--apres', '8000')) // observation après le dernier double-clic
const SORTIE = opt('--sortie', path.join(RACINE, '.banc', 'GEL2', ETIQ))
const dodo = (ms) => new Promise((r) => setTimeout(r, ms))
// le point cliqué : HORS du centre, pour que la dérive D19 se mesure
const P = [Number(opt('--px', '820')), Number(opt('--py', '290'))]

const LIEUX = {
  // Sulawesi, le lieu de la vidéo : z5 → z7 à gauche, z7 → z5 à droite
  sulawesi: { lat: -4.4349, lon: 121.7735, zGauche: 5, zDroit: 7 },
  // La Réunion en CROP (z12) : le bloc croppé, régime CROP
  reunion: { lat: -21.1, lon: 55.5, zGauche: 12, zDroit: 12 },
  brest: { lat: 48.38, lon: -4.49, zGauche: 5, zDroit: 7 },
  // le chemin de la VIDÉO : l'orbite (12 000 km) centrée sur Sulawesi, puis des
  // double-clics gauche jusqu'à z7 (orbite → plongée `_dive` → z5 → z6 → z7)
  orbite: { lat: -4.4349, lon: 121.7735, zGauche: 3, zDroit: 3, orbite: true },
}
const L = LIEUX[LIEU]
if (!L) { console.error('lieu inconnu'); process.exit(2) }
const Z0 = BOUTON === 'gauche' ? L.zGauche : L.zDroit

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

// ── dans la page : longtasks, images, trous, enveloppes, mesure D19 ──────────
const INSTRUMENTER = () => {
  const e = window.__exp
  const G = (window.__gel = { longtasks: [], images: 0, t0: performance.now(), erreurs: [], trous: [], env: [], gestes: [] })
  try {
    new PerformanceObserver((l) => { for (const t of l.getEntries()) G.longtasks.push({ debut: Math.round(t.startTime), ms: +t.duration.toFixed(1) }) }).observe({ entryTypes: ['longtask'] })
  } catch (err) { G.longtaskErr = String(err) }
  let tPrec = performance.now()
  const tic = (t) => { G.images++; if (t - tPrec > 100) G.trous.push({ t: Math.round(tPrec), ms: Math.round(t - tPrec) }); tPrec = t; requestAnimationFrame(tic) }
  requestAnimationFrame(tic)
  window.addEventListener('error', (ev) => G.erreurs.push(String(ev.message).slice(0, 200)))
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
  for (const n of ['rebuild', 'rafraichirFenetre', 'loadSurface', 'regenerate']) enveloppe(e.terrain, n, 'terrain.' + n)
  for (const n of ['update', '_buildMesh', 'poserCrop', 'construireParoisCrop']) enveloppe(e.globe, n, 'globe.' + n)
  for (const n of ['rebuild']) enveloppe(e.plinth, n, 'plinth.' + n)
  for (const n of ['update', '_applyZoom', '_zoomGesture', '_franchirSiBesoin', '_rescale', '_refine']) enveloppe(e.modes, n, 'modes.' + n)
  for (const n of ['loadSurface']) enveloppe(e.modes.hooks, n, 'hooks.' + n)
  for (const n of ['loadRealTerrain', 'regenerateTerrain']) enveloppe(e, n, 'exp.' + n)
  for (const n of ['render']) enveloppe(e.composer, n, 'composer.' + n)
  // les gestes reçus par la toile (pour prouver que le double-clic est ARRIVÉ)
  const toile = e.renderer.domElement
  for (const t of ['pointerdown', 'pointerup', 'dblclick', 'contextmenu']) toile.addEventListener(t, (ev) => G.gestes.push({ t: Math.round(performance.now()), type: t, b: ev.button, x: ev.clientX, y: ev.clientY }), true)
  // ── D19 : la sphère sous un pixel, et la projection d'un point ──
  const cam = e.camera, c = e.controls
  const V3 = cam.position.constructor
  const R_GLOBE = 100
  const gcam = () => e.camGlobe ?? cam
  const bb = () => toile.getBoundingClientRect()
  const sphereSous = (px, py) => {
    const camera = gcam(), r = bb()
    const nx = (px / r.width) * 2 - 1, ny = -((py / r.height) * 2 - 1)
    const o = camera.position.clone()
    const d = new V3(nx, ny, 0.5).unproject(camera).sub(o).normalize()
    const b = o.dot(d), cc = o.dot(o) - R_GLOBE * R_GLOBE
    const disc = b * b - cc
    if (disc < 0) return null
    const t = -b - Math.sqrt(disc)
    if (t < 0) return null
    const p = o.clone().addScaledVector(d, t).normalize()
    return [p.x, p.y, p.z]
  }
  const pxDe = (u) => {
    if (!u) return null
    const v = new V3(u[0] * R_GLOBE, u[1] * R_GLOBE, u[2] * R_GLOBE); v.project(gcam())
    const r = bb()
    return [(v.x * 0.5 + 0.5) * r.width, (-v.y * 0.5 + 0.5) * r.height]
  }
  G.etat = () => {
    const m = e.modes, g = gcam()
    const fwd = new V3(0, 0, -1).applyQuaternion(g.quaternion)
    const up = g.position.clone().normalize()
    const nord = new V3(0, 1, 0).addScaledVector(up, -up.y).normalize()
    const est = new V3().crossVectors(nord, up).normalize()
    const f = fwd.clone().addScaledVector(up, -fwd.dot(up))
    const cap = f.lengthSq() > 1e-12 ? Math.atan2(f.dot(est), f.dot(nord)) * 180 / Math.PI : null
    return {
      t: Math.round(performance.now()), mode: m.mode, z: e.params.demZoom, busy: !!m.busy, travel: !!m.travel, dive: !!m._diveTween, fondu: !!m._fonduPose,
      altM: Math.round((g.position.length() - R_GLOBE) * 63710), dist: +c.getDistance().toFixed(4), lvl: +(m._levelZoom ?? 0).toFixed(4),
      az: +(c.getAzimuthalAngle() * 180 / Math.PI).toFixed(3), cap: cap === null ? null : +cap.toFixed(3), pol: +(c.getPolarAngle() * 180 / Math.PI).toFixed(3),
      rtErr: e.regenerateTerrainErreurs ?? null, rebuildPending: null, regime: e.regimeGeste?.() ?? null, epingle: !!e.gestesTerre?.epingle, course: e.gestesTerre?.courseDoubleClic ? +e.gestesTerre.courseDoubleClic.restant.toFixed(4) : null, zoomVel: +(m._zoomVel ?? 0).toFixed(4),
      // GEL-4 : LE POINT SOUS LA CAMÉRA, en vecteur unité. L'angle entre deux
      // relevés EST le « roulis du sol » de GE3 (sa réserve : 3,71–3,92° au
      // double-clic droit, prix géométrique de la visée curseur), et il ne
      // dépend d'aucune convention de lat/lon. ⚠️ `az` d'OrbitControls ne le
      // mesure PAS : il rend 0 sur tous mes relevés alors que le sol tourne.
      sc: (() => { const p = g.position.clone().normalize(); return [+p.x.toFixed(7), +p.y.toFixed(7), +p.z.toFixed(7)] })(),
    }
  }
  G.saisir = (px, py) => { G.saisi = sphereSous(px, py); G.saisiPx = [px, py]; return !!G.saisi }
  G.derive = () => { const p = pxDe(G.saisi); return p ? +Math.hypot(p[0] - G.saisiPx[0], p[1] - G.saisiPx[1]).toFixed(2) : null }
  G.pret = () => !!(e.modes && !e.modes.busy && !e.modes.travel && !e.modes._diveTween)
}

fs.mkdirSync(SORTIE, { recursive: true })
const puppeteer = await chargerPuppeteer()
const nav = await puppeteer.launch({
  executablePath: trouverChrome(), headless: true,
  args: ['--headless=new', '--no-sandbox', `--window-size=${W},${H}`, '--autoplay-policy=no-user-gesture-required'],
})
const commit = (() => { try { return execSync('git rev-parse --short HEAD', { cwd: RACINE }).toString().trim() } catch { return null } })()
const bilan = { etiq: ETIQ, port: PORT, w: W, h: H, seq: SEQ.join(''), mesure: MESURE, lieu: LIEU, z0: Z0, bouton: BOUTON, enchaine: ENCHAINE, cpu: THROTTLE, dpr: DPR, P, date: new Date().toISOString(), commit, chargements: [] }
const T0 = Date.now()
const log = (m) => console.log(`[${((Date.now() - T0) / 1000).toFixed(0)} s] ${m}`)

try {
  for (let i = 0; i < N; i++) {
    const page = await nav.newPage()
    await page.setViewport({ width: W, height: H, deviceScaleFactor: DPR })
    const cdp = await page.target().createCDPSession()
    if (THROTTLE > 1) await cdp.send('Emulation.setCPUThrottlingRate', { rate: THROTTLE })
    await cdp.send('Debugger.enable')
    const erreursPage = []
    const c = { i, gel: false, pile: null, erreurs: [], trace: [] }
    bilan.chargements.push(c)
    page.on('pageerror', (er) => { const st = String(er.stack || er.message); erreursPage.push('pageerror: ' + String(er.message).slice(0, 300)); (c.piles ||= []).push({ tt: Date.now() - T0, stack: st.slice(0, 2500) }); log(`  [${i}] EXCEPTION DE PAGE : ` + st.split(String.fromCharCode(10)).slice(0, 8).join(String.fromCharCode(10) + '      ')) })
    page.on('console', (m) => { if (m.type() === 'error') erreursPage.push(m.type() + ': ' + m.text().slice(0, 200)) })
    let paused = null
    cdp.on('Debugger.paused', (p) => { paused = p })
    const souris = (type, x, y, button, buttons, clickCount) => cdp.send('Input.dispatchMouseEvent', { type, x, y, button, buttons, clickCount, pointerType: 'mouse' })
    const doubleClic = async (bouton) => {
      const b = bouton === 'gauche' ? 'left' : 'right', bs = bouton === 'gauche' ? 1 : 2
      await souris('mousePressed', P[0], P[1], b, bs, 1); await souris('mouseReleased', P[0], P[1], b, 0, 1)
      await dodo(60)
      await souris('mousePressed', P[0], P[1], b, bs, 2); await souris('mouseReleased', P[0], P[1], b, 0, 2)
    }

    // ── le chien de garde HORS page : une sonde à délai, `Debugger.pause` si le fil se tait ──
    let gele = false
    const sonder = async (phase) => {
      let rep = null
      try {
        rep = await Promise.race([
          cdp.send('Runtime.evaluate', { expression: 'JSON.stringify(Object.assign({im: __gel.images, lt: __gel.longtasks.length}, __gel.etat()))', returnByValue: true }),
          dodo(GEL_MS).then(() => null),
        ])
      } catch (er) { c.erreurs.push(phase + ': ' + String(er.message)); return null }
      if (rep && rep.result && rep.result.value) { const d = JSON.parse(rep.result.value); c.trace.push({ tt: Date.now() - T0, phase, ...d }); return d }
      // ── LE FIL NE RÉPOND PLUS ──
      gele = true; c.gel = true; c.phaseGel = phase
      log(`  [${i}] GEL (${phase}) — dernier état ${JSON.stringify(c.trace[c.trace.length - 1] || null)}`)
      for (const k of [1, 2]) {
        paused = null
        cdp.send('Debugger.pause').catch((er) => c.erreurs.push('pause: ' + er.message))
        const tp = Date.now()
        while (!paused && Date.now() - tp < 8000) await dodo(100)
        if (!paused) { c.erreurs.push('Debugger.pause sans réponse'); break }
        const pile = paused.callFrames.slice(0, 25).map((f) => `${f.functionName || '(anon)'} @ ${f.url.replace(/^.*\/\/[^/]+/, '')}:${f.location.lineNumber + 1}:${f.location.columnNumber + 1}`)
        c[k === 1 ? 'pile' : 'pile2'] = pile
        log('  pile' + (k === 2 ? ' 1,5 s plus tard' : '') + ' :\n    ' + pile.join('\n    '))
        try {
          const sc = paused.callFrames[0].scopeChain.find((s) => s.type === 'local')
          if (sc) {
            const props = await cdp.send('Runtime.getProperties', { objectId: sc.object.objectId, ownProperties: true })
            c['locales' + k] = props.result.slice(0, 40).map((p) => `${p.name}=${p.value ? (p.value.value !== undefined ? JSON.stringify(p.value.value) : p.value.description) : '?'}`.slice(0, 120))
          }
        } catch (er) { c.erreurs.push('locales: ' + er.message) }
        await cdp.send('Debugger.resume').catch(() => {})
        if (k === 1) await dodo(1500)
      }
      return null
    }
    // observe `ms` en sondant tous les 250 ms ; rend false si le fil a gelé
    const observer = async (phase, ms) => { const t = Date.now(); while (Date.now() - t < ms) { await dodo(250); if (!(await sonder(phase))) return false } return true }

    try {
      await page.goto(`http://127.0.0.1:${PORT}/`, { waitUntil: 'domcontentloaded', timeout: 90000 })
      await page.waitForFunction('!!(window.__exp && window.__exp.controls && window.__exp.modes && window.__exp.composer)', { timeout: 120000 })
      await page.waitForFunction("!!document.getElementById('loading')?.classList.contains('hidden')", { timeout: 180000 })
      await page.waitForFunction(() => {
        const e = window.__exp
        const d = e.camera.position.distanceTo(e.controls.target)
        const R = (window.__stab ??= { d: NaN, t: 0 })
        if (Math.abs(d - R.d) > 1e-4) { R.d = d; R.t = performance.now(); return false }
        return d > 100 && !e.modes.busy && performance.now() - R.t > 1500
      }, { timeout: 60000, polling: 100 })
      let sous = null
      for (let k = 0; k < 10; k++) {
        await page.keyboard.press('Escape').catch(() => {})
        await dodo(250)
        sous = await page.evaluate(() => document.elementFromPoint(640, 400)?.tagName ?? null)
        if (sous === 'CANVAS') break
      }
      if (sous !== 'CANVAS') throw new Error(`voile non fermé : elementFromPoint rend ${sous}`)
      await page.evaluate(INSTRUMENTER)
      // ── le vol au lieu de départ, sans attendre sa promesse (le chien de garde veille) ──
      page.evaluate((lat, lon, z) => { window.__gel.volFini = false; window.__exp.modes.flyTo(lat, lon, z).catch((er) => window.__gel.erreurs.push('flyTo: ' + er.message)).finally(() => { window.__gel.volFini = true }) }, L.lat, L.lon, Z0).catch(() => {})
      {
        const t = Date.now(); let ok = false
        while (Date.now() - t < 60000) { await dodo(250); const d = await sonder('vol'); if (!d) break; if (d.mode === 'surface' && d.z === Z0 && !d.busy && !d.travel && !d.dive) { ok = true; break } }
        if (gele) throw new Error('gel pendant le vol')
        if (!ok) c.erreurs.push('vol non fini en 60 s')
      }
      if (L.orbite) {
        // remonter en orbite (12 000 km) : la caméra garde lat/lon, comme `sonde-gel --chemin orbite`
        page.evaluate(() => { window.__exp.modes.enterOrbit(12e6).catch((er) => window.__gel.erreurs.push('enterOrbit: ' + er.message)) }).catch(() => {})
        const t = Date.now(); let ok = false
        while (Date.now() - t < 30000) { await dodo(250); const d = await sonder('orbite'); if (!d) break; if (d.mode === 'orbital' && !d.busy && !d.travel && !d.dive) { ok = true; break } }
        if (gele) throw new Error('gel pendant la remontée en orbite')
        if (!ok) c.erreurs.push('orbite non atteinte en 30 s')
      }
      // le fil respire 3 s (les raffinements du palier), puis on s'assure que la toile est sous le curseur
      if (!(await observer('repos', 3000))) throw new Error('gel au repos')
      sous = await page.evaluate(([x, y]) => document.elementFromPoint(x, y)?.tagName ?? null, P)
      if (sous !== 'CANVAS') { for (let k = 0; k < 6 && sous !== 'CANVAS'; k++) { await page.keyboard.press('Escape').catch(() => {}); await dodo(200); sous = await page.evaluate(([x, y]) => document.elementFromPoint(x, y)?.tagName ?? null, P) } }
      c.sousCurseur = sous
      await page.mouse.move(P[0], P[1])
      await dodo(300)
      c.avant = await page.evaluate(([x, y]) => { const G = window.__gel; G.saisir(x, y); return { ...G.etat(), saisi: !!G.saisi } }, P)
      log(`  [${i}] départ : mode ${c.avant.mode} z${c.avant.z} alt ${c.avant.altM} m régime ${c.avant.regime} saisi=${c.avant.saisi} sous=${sous}`)
      // ── LES DOUBLE-CLICS ──
      c.dblclics = []
      const nDc = L.orbite ? Number(opt('--niveaux', '12')) : SEQ.length
      for (let n = 0; n < nDc; n++) {
        const bouton = L.orbite ? BOUTON : (SEQ[n] === 'd' ? 'droit' : 'gauche')
        if (n === MESURE && n > 0) {
          // D19 se mesure à partir d'ici : on relit l'état et le point sous le curseur
          c.avant = await page.evaluate(([x, y]) => { const G = window.__gel; G.saisir(x, y); return { ...G.etat(), saisi: !!G.saisi } }, P)
          log(`  [${i}] mesure D19 depuis le double-clic ${n} (${bouton}) : mode ${c.avant.mode} z${c.avant.z} régime ${c.avant.regime} alt ${c.avant.altM} m`)
        }
        const tD = await page.evaluate(() => performance.now())
        await doubleClic(bouton)
        c.dblclics.push({ n, bouton, t: Math.round(tD) })
        if (n < nDc - 1) {
          if (ENCHAINE) { await dodo(250) } else { if (!(await observer(`dc${n}`, L.orbite ? 3000 : 4000))) break }
          if (L.orbite) { const d = c.trace[c.trace.length - 1]; if (d && d.mode === 'surface' && d.z >= Z_FIN) break }
        }
      }
      if (gele) throw new Error('gel pendant les double-clics')
      if (!(await observer('apres', APRES_MS))) throw new Error('gel après les double-clics')
      // ── D19 : le point cliqué est-il resté sous son pixel ? ──
      c.apres = await page.evaluate(() => ({ ...window.__gel.etat(), derivePx: window.__gel.derive(), gestes: window.__gel.gestes.length }))
      c.rapportAlt = +(c.apres.altM / Math.max(1, c.avant.altM)).toFixed(4)
      c.dAz = +((c.apres.az - c.avant.az + 540) % 360 - 180).toFixed(3)
      c.dCap = c.apres.cap != null && c.avant.cap != null ? +((c.apres.cap - c.avant.cap + 540) % 360 - 180).toFixed(3) : null
      // GEL-4 : le roulis du SOL (GE3) — l'angle entre les deux points sous la caméra
      c.roulisDeg = c.avant.sc && c.apres.sc
        ? +(Math.acos(Math.min(1, Math.max(-1, c.avant.sc[0] * c.apres.sc[0] + c.avant.sc[1] * c.apres.sc[1] + c.avant.sc[2] * c.apres.sc[2]))) * 180 / Math.PI).toFixed(3)
        : null
      // ── L'ÉPREUVE DE RÉPONSE : un double-clic de plus, la caméra bouge-t-elle ? ──
      const av = await page.evaluate(() => window.__gel.etat())
      await doubleClic(L.orbite ? BOUTON : (SEQ[SEQ.length - 1] === 'd' ? 'droit' : 'gauche'))
      if (!(await observer('reponse', 4000))) throw new Error('gel à l\'épreuve de réponse')
      const ap = await page.evaluate(() => window.__gel.etat())
      c.reponse = { avant: av, apres: ap, repond: ap.altM !== av.altM || ap.z !== av.z, busyRetombe: !ap.busy }
      const d = await page.evaluate(() => ({ lt: window.__gel.longtasks, trous: window.__gel.trous, env: window.__gel.env, err: window.__gel.erreurs, gestes: window.__gel.gestes, im: window.__gel.images }))
      c.longtasks = d.lt.sort((a, b) => b.ms - a.ms).slice(0, 8)
      c.plusLongue = c.longtasks[0]?.ms ?? 0
      c.trous = d.trous.sort((a, b) => b.ms - a.ms).slice(0, 8)
      c.env = d.env.sort((a, b) => b.ms - a.ms).slice(0, 12)
      c.gestes = d.gestes
      c.images = d.im
      c.erreurs.push(...d.err)
      log(`  [${i}] sans gel — z${c.avant.z}→z${c.apres.z}, alt ×${c.rapportAlt}, dérive ${c.apres.derivePx} px, Δaz ${c.dAz}°, Δcap ${c.dCap}°, roulis sol ${c.roulisDeg}°, répond=${c.reponse.repond} busy=${c.apres.busy} tâche max ${c.plusLongue} ms, trou max ${c.trous[0]?.ms ?? 0} ms, gestes reçus ${d.gestes.length}`)
    } catch (er) {
      c.erreurs.push('chargement: ' + String(er.message).slice(0, 300))
      if (!c.gel) log(`  [${i}] ERREUR ${er.message}`)
    }
    c.erreurs.push(...erreursPage)
    try { await page.screenshot({ path: path.join(SORTIE, `charg-${i}.png`) }) } catch {}
    await page.close().catch(() => {})
  }
} finally {
  await nav.close().catch(() => {})
}
bilan.gels = bilan.chargements.filter((c) => c.gel).length
bilan.plusLongue = Math.max(0, ...bilan.chargements.map((c) => c.plusLongue || 0))
fs.writeFileSync(path.join(SORTIE, 'bilan.json'), JSON.stringify(bilan, null, 2))
console.log(`\n${ETIQ} : ${bilan.gels}/${N} gels, plus longue tâche ${bilan.plusLongue} ms → ${SORTIE}`)
