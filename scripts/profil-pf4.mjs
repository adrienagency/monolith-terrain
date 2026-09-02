// SONDE PF4 — les bugs qui coûtent, rejouables en une commande.
//
// Chrome sans tête piloté au PROTOCOLE (CDP brut sur WebSocket, Node ≥ 22) :
// aucune dépendance, ni puppeteer ni playwright. Le serveur de dev doit déjà
// tourner (`npm run dev -- --port 6311 --strictPort`).
//
// SCÉNARIOS (`--scenario`) :
//   gl      erreurs GL par image composée, message exact du pilote, sur N images
//           (`--bokeh 1` allume le flou de profondeur par le chemin de l'usager)
//   repos   temps d'image au repos en orbite (rotation propre) : période, CPU,
//           GPU (EXT_disjoint_timer_query_webgl2 + témoin ×16 de fragments),
//           images DESSINÉES par seconde, tas JS sur `--secondes` s
//   palier  le palier machine lu au démarrage, `signaux.ecran`, et chaque
//           bannière PERFORMANCE — avec `--cpu 4|6` (Emulation.setCPUThrottlingRate)
//   voile   l'accueil : la croix est-elle atteignable, un glissé passe-t-il,
//           un double-clic, que reçoit la toile
//   clic    un clic au centre du globe en orbite : rapport d'altitude par image
//   fuites  trois changements de lieu : textures / géométries / programmes /
//           écouteurs avant et après
//   pixel   les trois postes de PF1 (orbite 2 000 km · surface 130 km · crop
//           5 km), animations coupées, deux rendus à la main : l'image est
//           écrite en RGBA brut (`--dossier`) pour une comparaison AU BIT entre
//           deux variantes (`--comparer a.rgba b.rgba`, sans navigateur)
//
// OPTIONS : --port 6311 · --url "?x=1" (suffixe d'URL) · --images 600 ·
//           --secondes 60 · --cpu 1 · --bokeh 0 · --sortie fichier.json ·
//           --chrome <chemin> · --swiftshader 1 (GPU logiciel, pire cas) ·
//           --largeur 1280 --hauteur 800 · --dpr 1
//
// ⚠️ Chaque relevé écrit son banc (taille, ralentissement, dpr, palier,
// mode, altitude) : un chiffre sans banc ne se compare à rien.

import fs from 'node:fs'
import os from 'node:os'
import path from 'node:path'
import http from 'node:http'
import { spawn } from 'node:child_process'

// ------------------------------------------------------------------ arguments
const A = process.argv.slice(2)
const opt = (n, d) => { const i = A.indexOf(n); return i >= 0 && A[i + 1] != null ? A[i + 1] : d }
const SCENARIO = opt('--scenario', 'gl')
const PORT = Number(opt('--port', '6311'))
const URL_SUFFIXE = opt('--url', '')
const IMAGES = Number(opt('--images', '600'))
const SECONDES = Number(opt('--secondes', '60'))
const CPU = Number(opt('--cpu', '1'))
const BOKEH = opt('--bokeh', '0') === '1'
const SORTIE = opt('--sortie', null)
const SWIFT = opt('--swiftshader', '0') === '1'
const LARGEUR = Number(opt('--largeur', '1280'))
const HAUTEUR = Number(opt('--hauteur', '800'))
const DPR = Number(opt('--dpr', '1'))
const DBG_PORT = Number(opt('--dbg', '9333'))
const ORBITE = opt('--orbite', '0') === '1'
const ALTITUDE = Number(opt('--altitude', '0')) // m ; 0 = altitude d'entrée par défaut de enterOrbit
const CLICS = Number(opt('--clics', '11'))
const ERREURS = opt('--erreurs', '1') === '1'
const DOSSIER = opt('--dossier', '.banc/PF4/pixel')
const COMPARER = A.indexOf('--comparer') >= 0 ? A.slice(A.indexOf('--comparer') + 1, A.indexOf('--comparer') + 3) : null
const POSTES = opt('--postes', 'surface,crop,orbite').split(',').filter(Boolean) // l'ordre de PF1 : la surface d'abord, l'orbite en dernier (diveTo ne ramène pas de l'orbite) // gl : lire gl.getError() après chaque image (un point de synchronisation : à couper pour chronométrer)

function trouverChrome() {
  const donne = opt('--chrome', process.env.CHROME_PATH)
  if (donne) return donne
  const pistes = [
    'C:/Program Files/Google/Chrome/Application/chrome.exe',
    'C:/Program Files (x86)/Google/Chrome/Application/chrome.exe',
    '/Applications/Google Chrome.app/Contents/MacOS/Google Chrome',
    '/usr/bin/google-chrome',
    '/usr/bin/chromium',
  ]
  const t = pistes.find((p) => fs.existsSync(p))
  if (!t) { console.error('Chrome introuvable : --chrome <chemin> ou CHROME_PATH'); process.exit(2) }
  return t
}

// ------------------------------------------------------------------ CDP brut
const dors = (ms) => new Promise((r) => setTimeout(r, ms))

function getJson(url) {
  return new Promise((res, rej) => {
    http.get(url, (r) => { let s = ''; r.on('data', (d) => (s += d)); r.on('end', () => { try { res(JSON.parse(s)) } catch (e) { rej(e) } }) }).on('error', rej)
  })
}

class Cdp {
  constructor(ws) {
    this.ws = ws
    this.id = 0
    this.attente = new Map()
    this.ecouteurs = []
    ws.onmessage = (ev) => {
      const m = JSON.parse(ev.data)
      if (m.id != null && this.attente.has(m.id)) {
        const { res, rej } = this.attente.get(m.id)
        this.attente.delete(m.id)
        m.error ? rej(new Error(m.error.message + ' (' + m.error.code + ')')) : res(m.result)
      } else if (m.method) {
        for (const f of this.ecouteurs) f(m)
      }
    }
  }
  send(method, params = {}, sessionId) {
    const id = ++this.id
    const msg = { id, method, params }
    if (sessionId) msg.sessionId = sessionId
    this.ws.send(JSON.stringify(msg))
    return new Promise((res, rej) => this.attente.set(id, { res, rej }))
  }
  on(f) { this.ecouteurs.push(f) }
}

async function lancerChrome() {
  const chrome = trouverChrome()
  const profil = fs.mkdtempSync(path.join(os.tmpdir(), 'pf4-chrome-'))
  const args = [
    '--headless=new', '--no-sandbox', '--no-first-run', '--disable-gpu-vsync', '--disable-frame-rate-limit',
    `--remote-debugging-port=${DBG_PORT}`, `--user-data-dir=${profil}`,
    `--window-size=${LARGEUR},${HAUTEUR}`, '--enable-precise-memory-info',
    '--enable-unsafe-swiftshader', '--disable-background-timer-throttling', '--disable-renderer-backgrounding',
    '--hide-scrollbars', 'about:blank',
  ]
  if (SWIFT) args.push('--use-angle=swiftshader')
  const proc = spawn(chrome, args, { stdio: 'ignore' })
  let version = null
  for (let i = 0; i < 100 && !version; i++) {
    try { version = await getJson(`http://127.0.0.1:${DBG_PORT}/json/version`) } catch { await dors(100) }
  }
  if (!version) { proc.kill(); throw new Error('Chrome ne répond pas sur le port de débogage') }
  const ws = new WebSocket(version.webSocketDebuggerUrl)
  await new Promise((res, rej) => { ws.onopen = res; ws.onerror = rej })
  const cdp = new Cdp(ws)
  const { targetId } = await cdp.send('Target.createTarget', { url: 'about:blank' })
  const { sessionId } = await cdp.send('Target.attachToTarget', { targetId, flatten: true })
  const fermer = async () => { try { ws.close() } catch { /* rien */ } proc.kill(); await dors(300); try { fs.rmSync(profil, { recursive: true, force: true }) } catch { /* rien */ } }
  return { cdp, sessionId, fermer, version: version.Browser }
}

// ------------------------------------------------------------------ page
async function ouvrirPage() {
  const { cdp, sessionId: s, fermer, version } = await lancerChrome()
  const journal = [] // console + Log (messages du pilote WebGL) + exceptions
  const t0 = Date.now()
  cdp.on((m) => {
    if (m.sessionId !== s) return
    if (m.method === 'Log.entryAdded') journal.push({ t: Date.now() - t0, quoi: 'log', source: m.params.entry.source, niveau: m.params.entry.level, texte: m.params.entry.text })
    else if (m.method === 'Runtime.consoleAPICalled') journal.push({ t: Date.now() - t0, quoi: 'console', niveau: m.params.type, texte: m.params.args.map((a) => a.value ?? a.description ?? '').join(' ') })
    else if (m.method === 'Runtime.exceptionThrown') journal.push({ t: Date.now() - t0, quoi: 'exception', texte: m.params.exceptionDetails.exception?.description || m.params.exceptionDetails.text })
  })
  await cdp.send('Page.enable', {}, s)
  await cdp.send('Runtime.enable', {}, s)
  await cdp.send('Log.enable', {}, s)
  await cdp.send('Emulation.setDeviceMetricsOverride', { width: LARGEUR, height: HAUTEUR, deviceScaleFactor: DPR, mobile: false }, s)
  if (CPU > 1) await cdp.send('Emulation.setCPUThrottlingRate', { rate: CPU }, s)
  const evaluer = async (expression) => {
    const r = await cdp.send('Runtime.evaluate', { expression, awaitPromise: true, returnByValue: true }, s)
    if (r.exceptionDetails) throw new Error('page : ' + (r.exceptionDetails.exception?.description || r.exceptionDetails.text))
    return r.result.value
  }
  const naviguer = (url) => cdp.send('Page.navigate', { url }, s)
  const touche = async (key, code) => {
    await cdp.send('Input.dispatchKeyEvent', { type: 'keyDown', key, code, windowsVirtualKeyCode: key === 'Escape' ? 27 : 0 }, s)
    await cdp.send('Input.dispatchKeyEvent', { type: 'keyUp', key, code, windowsVirtualKeyCode: key === 'Escape' ? 27 : 0 }, s)
  }
  const souris = (p) => cdp.send('Input.dispatchMouseEvent', p, s)
  return { cdp, s, fermer, version, journal, evaluer, naviguer, touche, souris }
}

// attend que la caméra ne bouge plus d'elle-même (vol d'ouverture, plongée)
async function attendreImmobile(p, maxMs = 40000) {
  const t0 = Date.now()
  let avant = await p.evaluer(`window.__exp.camera.position.toArray()`)
  while (Date.now() - t0 < maxMs) {
    await dors(500)
    const apres = await p.evaluer(`window.__exp.camera.position.toArray()`)
    const bouge = Math.hypot(...avant.map((v, i) => v - apres[i]))
    const occupe = await p.evaluer(`!!(window.__exp.modes.busy || window.__exp.tween)`)
    if (bouge < 1e-4 && !occupe) return Date.now() - t0
    avant = apres
  }
  return -1
}

// attend le premier dessin : `renderer.info.render.frame > 0` et le loader effacé
async function attendrePret(p, maxMs = 90000) {
  const t0 = Date.now()
  while (Date.now() - t0 < maxMs) {
    const ok = await p.evaluer(`(() => { const e = window.__exp; return !!(e && e.renderer && e.renderer.info.render.frame > 3 && document.getElementById('loading')?.classList.contains('hidden')) })()`)
    if (ok) return Date.now() - t0
    await dors(250)
  }
  throw new Error('la page n’a pas dessiné en ' + maxMs + ' ms')
}

// LA SONDE EN PAGE — enveloppe `composer.render` : période, CPU de soumission,
// GPU (requête de temps), erreurs GL, altitude de la caméra de rendu.
const SONDE = `(() => {
  if (window.__pf4) return 'déjà posée'
  const e = window.__exp
  const gl = e.renderer.getContext()
  const ext = gl.getExtension('EXT_disjoint_timer_query_webgl2')
  const st = { trames: [], compter: false, erreursGL: false, gpu: !!ext, marques: [], derniere: performance.now(), images: 0 }
  const orig = e.composer.render.bind(e.composer)
  e.composer.render = function (dt) {
    st.images++
    if (!st.compter) return orig(dt)
    const t0 = performance.now()
    let q = null
    if (ext) { q = gl.createQuery(); gl.beginQuery(ext.TIME_ELAPSED_EXT, q) }
    orig(dt)
    if (q) gl.endQuery(ext.TIME_ELAPSED_EXT)
    const t1 = performance.now()
    let errs = null
    if (st.erreursGL) { errs = []; let x, n = 0; while ((x = gl.getError()) !== gl.NO_ERROR && n < 8) { errs.push(x); n++ } }
    const cg = e.camGlobe || e.camera
    st.trames.push({ t: t1, periode: t1 - st.derniere, cpu: t1 - t0, gpu: null, q, errs,
      mode: e.modes.mode, busy: !!e.modes.busy, palier: e.aq ? e.aq.tier : null,
      altG: (cg.position.length() - 100) * 63710, tri: e.renderer.info.render.triangles, appels: e.renderer.info.render.calls })
    st.derniere = t1
  }
  st.resoudre = () => {
    if (!ext) return
    for (const f of st.trames) {
      if (!f.q) continue
      const dispo = gl.getQueryParameter(f.q, gl.QUERY_RESULT_AVAILABLE)
      const disj = gl.getParameter(ext.GPU_DISJOINT_EXT)
      if (dispo) { f.gpu = disj ? -1 : gl.getQueryParameter(f.q, gl.QUERY_RESULT) / 1e6; gl.deleteQuery(f.q); f.q = null }
    }
  }
  st.releve = () => {
    st.resoudre()
    const t = st.trames.map(({ q, ...r }) => r)
    st.trames = []
    return t
  }
  // les bannières du gouverneur et des modes
  const annonce = e.modes.announce.bind(e.modes)
  e.modes.announce = (m) => { st.marques.push({ t: performance.now(), texte: m }); return annonce(m) }
  window.__pf4 = st
  return 'posée'
})()`

const ETAT = `(() => { const e = window.__exp; const m = window.__palierMachine; const cg = e.camGlobe || e.camera
  return { mode: e.modes.mode, busy: !!e.modes.busy, palier: e.aq ? e.aq.tier : null, palierDepart: e.aq ? e.aq.startTier : null,
    palierMachine: m ? { palier: m.palier, carte: m.carte, charge: m.charge, densite: m.densite, mpxServis: m.mpxServis, ecran: m.signaux && m.signaux.ecran, raisons: m.raisons } : null,
    ecranNav: [screen.width, screen.height, innerWidth, innerHeight, devicePixelRatio], altG: (cg.position.length() - 100) * 63710,
    pixelRatio: e.params.pixelRatio, bokeh: !!e.params.bokehEnabled, animations: e.params.animations, passes: e.composer.passes.filter((p) => p.enabled).map((p) => p.constructor.name),
    memoire: { ...e.renderer.info.memory, programmes: e.renderer.info.programs.length }, tailleTampon: [e.renderer.getContext().drawingBufferWidth, e.renderer.getContext().drawingBufferHeight],
    tas: performance.memory ? performance.memory.usedJSHeapSize : null, images: window.__pf4 ? window.__pf4.images : null } })()`

const quantiles = (xs) => {
  const v = xs.filter((x) => Number.isFinite(x) && x >= 0).sort((a, b) => a - b)
  if (!v.length) return { n: 0 }
  const q = (p) => v[Math.min(v.length - 1, Math.floor(p * v.length))]
  return { n: v.length, p50: +q(0.5).toFixed(3), p90: +q(0.9).toFixed(3), p99: +q(0.99).toFixed(3), max: +v[v.length - 1].toFixed(3), moy: +(v.reduce((a, b) => a + b, 0) / v.length).toFixed(3) }
}

async function fermerVoile(p) {
  await p.touche('Escape', 'Escape')
  await dors(400)
  return p.evaluer(`!document.body.classList.contains('ce-hub')`)
}

async function allumerBokeh(p) {
  return p.evaluer(`(() => { const lab = [...document.querySelectorAll('label')].find((x) => /bokeh/i.test(x.textContent || ''))
    if (!lab) return 'interrupteur bokeh introuvable'
    lab.parentElement.querySelector('button.ce-toggle').click()
    return window.__exp.composer.passes.filter((p) => p.enabled).map((p) => p.constructor.name).join(' → ') })()`)
}

// ------------------------------------------------------------------ scénarios
async function scenarioGl(p) {
  await p.evaluer(SONDE)
  if (BOKEH) console.log('  bokeh : ' + (await allumerBokeh(p)))
  await dors(1500)
  await p.evaluer(`window.__pf4.compter = true; window.__pf4.erreursGL = ${ERREURS}; window.__pf4.releve()`)
  const debut = Date.now()
  while ((await p.evaluer(`window.__pf4.trames.length`)) < IMAGES && Date.now() - debut < 120000) await dors(500)
  const trames = await p.evaluer(`window.__pf4.releve()`)
  await p.evaluer(`window.__pf4.compter = false`)
  const parImage = trames.map((t) => (t.errs ? t.errs.length : 0))
  const avecErreur = parImage.filter((n) => n > 0).length
  const codes = {}
  for (const t of trames) for (const c of t.errs || []) codes[c] = (codes[c] || 0) + 1
  const messages = p.journal.filter((j) => /GL_|WebGL/i.test(j.texte)).map((j) => j.texte)
  const uniques = [...new Set(messages.map((m) => m.replace(/^\[\.WebGL-[^\]]*\]\s*/, '')))]
  return {
    images: trames.length, imagesAvecErreur: avecErreur, erreursParImage: ERREURS ? +(trames.reduce((a, t) => a + t.errs.length, 0) / trames.length).toFixed(3) : null,
    codes, messagesUniques: uniques, nbMessages: messages.length,
    cpu: quantiles(trames.map((t) => t.cpu)), gpu: quantiles(trames.map((t) => t.gpu)), periode: quantiles(trames.map((t) => t.periode)),
  }
}

async function scenarioRepos(p) {
  await p.evaluer(SONDE)
  // témoin de validité de la minuterie GPU : ×16 de fragments (densité 0,25 → 1)
  const temoin = {}
  for (const dens of [0.25, 1]) {
    await p.evaluer(`(() => { const e = window.__exp; e.params.pixelRatio = ${dens}; e.renderer.setPixelRatio(${dens}); e.composer.setSize(innerWidth, innerHeight) })()`)
    await dors(800) // chauffe
    await p.evaluer(`window.__pf4.compter = true; window.__pf4.releve()`)
    await dors(1500)
    const tr = await p.evaluer(`window.__pf4.releve()`)
    await dors(300)
    await p.evaluer(`window.__pf4.resoudre()`)
    temoin[dens] = quantiles(tr.map((t) => t.gpu))
  }
  const dprVoulu = await p.evaluer(`(() => { const e = window.__exp; const d = Math.min(devicePixelRatio, window.__palierMachine ? window.__palierMachine.densite : 2); e.params.pixelRatio = d; e.renderer.setPixelRatio(d); e.composer.setSize(innerWidth, innerHeight); return d })()`)
  const rapportTemoin = temoin[1].p50 && temoin[0.25].p50 ? +(temoin[1].p50 / temoin[0.25].p50).toFixed(2) : null
  // le repos : 4 s sans geste, puis on compte
  await dors(4000)
  await p.evaluer(`window.__pf4.compter = true; window.__pf4.releve()`)
  const tas = []
  const debut = Date.now()
  const etat0 = await p.evaluer(ETAT)
  let images0 = etat0.images
  const parSeconde = []
  while (Date.now() - debut < SECONDES * 1000) {
    await dors(1000)
    const e = await p.evaluer(`({ tas: performance.memory ? performance.memory.usedJSHeapSize : null, images: window.__pf4.images, n: window.__pf4.trames.length })`)
    tas.push(e.tas)
    parSeconde.push(e.images - images0)
    images0 = e.images
  }
  const trames = await p.evaluer(`window.__pf4.releve()`)
  await dors(300)
  const etat1 = await p.evaluer(ETAT)
  const modes = {}
  for (const t of trames) modes[t.mode] = (modes[t.mode] || 0) + 1
  return {
    banc: { dpr: dprVoulu, cpu: CPU, taille: [LARGEUR, HAUTEUR], swiftshader: SWIFT, palier: etat0.palier, palierMachine: etat0.palierMachine?.palier, mode: etat0.mode, altG: Math.round(etat0.altG), animations: etat0.animations, passes: etat0.passes },
    temoinGpu: { densite025: temoin[0.25], densite1: temoin[1], rapport: rapportTemoin, valide: rapportTemoin != null && rapportTemoin > 4 },
    images: trames.length, modes, imagesDessineesParSeconde: quantiles(parSeconde), periode: quantiles(trames.map((t) => t.periode)), cpu: quantiles(trames.map((t) => t.cpu)), gpu: quantiles(trames.map((t) => t.gpu)),
    triangles: quantiles(trames.map((t) => t.tri)), appels: quantiles(trames.map((t) => t.appels)),
    tasMo: { debut: +(tas[0] / 1048576).toFixed(1), fin: +(tas[tas.length - 1] / 1048576).toFixed(1), min: +(Math.min(...tas) / 1048576).toFixed(1), max: +(Math.max(...tas) / 1048576).toFixed(1), serie: tas.map((x) => +(x / 1048576).toFixed(1)) },
    memoire: { avant: etat0.memoire, apres: etat1.memoire },
  }
}

async function scenarioPalier(p, tNav) {
  await p.evaluer(SONDE)
  const etat = await p.evaluer(ETAT)
  const marques = []
  const debut = Date.now()
  const paliers = []
  const parSeconde = []
  const modes = []
  let voileFerme = false
  let images0 = await p.evaluer(`window.__pf4.images`)
  while (Date.now() - debut < SECONDES * 1000) {
    await dors(1000)
    if (!voileFerme && (await p.evaluer(`document.body.classList.contains('ce-hub')`))) { await p.touche('Escape', 'Escape'); voileFerme = true; marques.push({ t: +((Date.now() - debut) / 1000).toFixed(1), texte: '(voile fermé par la sonde)' }) }
    const e = await p.evaluer(`({ palier: window.__exp.aq ? window.__exp.aq.tier : null, mode: window.__exp.modes.mode + (window.__exp.modes.busy ? '!' : ''), marques: window.__pf4.marques.splice(0), images: window.__pf4.images })`)
    paliers.push(e.palier)
    modes.push(e.mode)
    parSeconde.push(e.images - images0)
    images0 = e.images
    for (const m of e.marques) marques.push({ t: +((m.t) / 1000).toFixed(1), texte: m.texte })
  }
  return { banc: { cpu: CPU, dpr: DPR, taille: [LARGEUR, HAUTEUR], swiftshader: SWIFT, premierDessinMs: tNav }, palierMachine: etat.palierMachine, ecranNav: etat.ecranNav, palierDepart: etat.palierDepart, palierParSeconde: paliers, imagesParSeconde: parSeconde, modeParSeconde: modes, bannieres: marques, journalPerf: p.journal.filter((j) => /palier|PERFORMANCE|ESSENTIAL/i.test(j.texte)).map((j) => j.texte).slice(0, 10) }
}

async function scenarioVoile(p) {
  const r = { avant: await p.evaluer(`({ voile: document.body.classList.contains('ce-hub'), croix: (() => { const c = document.querySelector('.ce-hubclose'); if (!c) return null; const b = c.getBoundingClientRect(); const el = document.elementFromPoint(b.left + b.width / 2, b.top + b.height / 2); return { rect: [b.left, b.top, b.width, b.height], sousLeCurseur: el ? el.tagName + '.' + el.className : null, estLaCroix: el === c, opacite: getComputedStyle(c).opacity, pointerEvents: getComputedStyle(c).pointerEvents } })(), centre: (() => { const el = document.elementFromPoint(innerWidth / 2, innerHeight / 2); return el ? el.tagName + '.' + el.className : null })() })`) }
  if (!r.avant.voile) { r.note = 'le voile n’est pas ouvert : rien à mesurer'; return r }
  // 1) un GLISSÉ de 160 px À GAUCHE de la barre : la caméra bouge-t-elle ? le voile se ferme-t-il ?
  r.immobileApresMs = await attendreImmobile(p)
  const temoin0 = await p.evaluer(`window.__exp.camera.position.toArray()`)
  await dors(1000)
  const cam0 = await p.evaluer(`window.__exp.camera.position.toArray()`)
  r.temoinSansGeste = Math.hypot(...temoin0.map((v, i) => v - cam0[i]))
  const sx = 200, sy = HAUTEUR / 2
  r.sousLeGeste = await p.evaluer(`(() => { const el = document.elementFromPoint(${sx}, ${sy}); return el ? el.tagName + '.' + el.className : null })()`)
  await p.souris({ type: 'mousePressed', x: sx, y: sy, button: 'left', buttons: 1, clickCount: 1 })
  for (let k = 1; k <= 16; k++) { await p.souris({ type: 'mouseMoved', x: sx + 10 * k, y: sy, button: 'left', buttons: 1 }); await dors(16) }
  await p.souris({ type: 'mouseReleased', x: sx + 160, y: sy, button: 'left', buttons: 0, clickCount: 1 })
  await dors(600)
  const cam1 = await p.evaluer(`window.__exp.camera.position.toArray()`)
  r.glisse = { voileFermeApres: await p.evaluer(`!document.body.classList.contains('ce-hub')`), cameraBouge: Math.hypot(...cam0.map((v, i) => v - cam1[i])) > 1e-6, deplacement: Math.hypot(...cam0.map((v, i) => v - cam1[i])) }
  return r
}

async function scenarioVoileCroix(p) {
  const c = await p.evaluer(`(() => { const c = document.querySelector('.ce-hubclose'); const b = c.getBoundingClientRect(); return [b.left + b.width / 2, b.top + b.height / 2] })()`)
  await p.souris({ type: 'mousePressed', x: c[0], y: c[1], button: 'left', buttons: 1, clickCount: 1 })
  await p.souris({ type: 'mouseReleased', x: c[0], y: c[1], button: 'left', buttons: 0, clickCount: 1 })
  await dors(500)
  return { croixEn: c, voileFermeApres: await p.evaluer(`!document.body.classList.contains('ce-hub')`) }
}

async function scenarioVoileDouble(p) {
  await attendreImmobile(p)
  const etat0 = await p.evaluer(ETAT)
  const sx = 200, sy = HAUTEUR / 2
  const sous = await p.evaluer(`(() => { const el = document.elementFromPoint(${sx}, ${sy}); return el ? el.tagName + '.' + el.className : null })()`)
  for (const n of [1, 2]) {
    await p.souris({ type: 'mousePressed', x: sx, y: sy, button: 'left', buttons: 1, clickCount: n })
    await p.souris({ type: 'mouseReleased', x: sx, y: sy, button: 'left', buttons: 0, clickCount: n })
    await dors(60)
  }
  await dors(1500)
  const etat1 = await p.evaluer(ETAT)
  return { sousLeGeste: sous, avant: { mode: etat0.mode, altG: Math.round(etat0.altG) }, apres: { mode: etat1.mode, busy: etat1.busy, altG: Math.round(etat1.altG) }, voileFermeApres: await p.evaluer(`!document.body.classList.contains('ce-hub')`), marques: await p.evaluer(`window.__pf4 ? window.__pf4.marques.map((m) => m.texte) : []`) }
}

async function scenarioClic(p) {
  await p.evaluer(SONDE)
  await dors(500)
  await p.evaluer(`window.__pf4.compter = true; window.__pf4.releve()`)
  const sx = LARGEUR / 2, sy = HAUTEUR / 2
  const clics = []
  let trames = []
  for (let n = 1; n <= CLICS; n++) {
    const avant = await p.evaluer(`window.__pf4.trames.length`)
    const etatAvant = await p.evaluer(`({ mode: window.__exp.modes.mode, alt: ((window.__exp.camGlobe || window.__exp.camera).position.length() - 100) * 63710, zoom: window.__exp.params.demZoom })`)
    await p.souris({ type: 'mousePressed', x: sx, y: sy, button: 'left', buttons: 1, clickCount: 1 })
    await dors(40)
    await p.souris({ type: 'mouseReleased', x: sx, y: sy, button: 'left', buttons: 0, clickCount: 1 })
    // attendre la fin de la plongée puis l'immobilité
    await dors(1500)
    const t0 = Date.now()
    while (Date.now() - t0 < 30000 && (await p.evaluer(`!!(window.__exp.modes.busy || window.__exp.modes.travel || window.__exp.modes._diveTween)`))) await dors(250)
    await attendreImmobile(p, 15000)
    const etatApres = await p.evaluer(`({ mode: window.__exp.modes.mode, alt: ((window.__exp.camGlobe || window.__exp.camera).position.length() - 100) * 63710, zoom: window.__exp.params.demZoom })`)
    clics.push({ n, imageDepart: avant, avant: etatAvant, apres: etatApres })
    if (etatApres.zoom === etatAvant.zoom && etatApres.mode === etatAvant.mode && n > 1) break // le clic ne fait plus rien
  }
  trames = await p.evaluer(`window.__pf4.releve()`)
  const sauts = []
  for (let i = 1; i < trames.length; i++) {
    const a = trames[i - 1].altG, b = trames[i].altG
    if (a > 0 && b > 0) { const r = Math.max(a / b, b / a); if (r > 1.05) sauts.push({ image: i, avant: Math.round(a), apres: Math.round(b), rapport: +r.toFixed(4), deplacementRelatif: null, mode: trames[i].mode, busy: trames[i].busy, periodeMs: +trames[i].periode.toFixed(1) }) }
  }
  return { images: trames.length, clics, sauts, marques: await p.evaluer(`window.__pf4.marques.map((m) => m.texte)`), modeFinal: trames[trames.length - 1]?.mode }
}

// LES TROIS POSTES DE PF1 — la même pose (scripts/profil-pf1.mjs, poserPoste), recopiée
const POSTES_PF1 = { surface: { alt: 130000, zoom: 9 }, crop: { alt: 5000, zoom: 13 }, orbite: { alt: 2000000, orbite: true } }
const LIEU_PF1 = { lat: -21.115, lon: 55.536 } // La Réunion, comme PF1
async function poserPoste(p, poste) {
  const P = POSTES_PF1[poste]
  if (P.orbite) {
    await p.evaluer(`(async () => { const m = window.__exp.modes; const alt = ${P.alt}
      if (m.mode !== 'orbital') await m.enterOrbit(alt)
      await new Promise((r) => setTimeout(r, 1500))
      for (let i = 0; i < 6; i++) { const parM = m.orbAlt / Math.max(m.altM, 1); m.orbAlt = m.orbAltTarget = alt * parM; await new Promise((r) => setTimeout(r, 300)); if (Math.abs(m.altM - alt) / alt < 0.005) break }
      return m.altM })()`)
  } else {
    await p.evaluer(`(async () => { const e = window.__exp; const m = e.modes; const lieu = ${JSON.stringify(LIEU_PF1)}; const zoom = ${P.zoom}; const alt = ${P.alt}
      if (m.mode === 'orbital') { await m.diveTo?.({ lat: lieu.lat, lon: lieu.lon }); await new Promise((r) => setTimeout(r, 3000)) }
      await m._rescale({ lat: lieu.lat, lon: lieu.lon, zoom }, 'PF4')
      await new Promise((r) => setTimeout(r, 1500))
      const cam = e.camera, ct = e.controls
      ct.minDistance = 1e-4; ct.maxDistance = 1e12
      const dir = cam.position.clone().sub(ct.target).normalize()
      for (let i = 0; i < 40; i++) { const a = e.altitudeCadrageM(); if (!Number.isFinite(a) || a <= 0) break; const d = cam.position.distanceTo(ct.target); const nd = d * (alt / a); if (!Number.isFinite(nd) || nd <= 0) break; cam.position.copy(ct.target).addScaledVector(dir, nd); ct.update?.(); if (Math.abs(e.altitudeCadrageM() - alt) / alt < 0.004) break }
      return e.altitudeCadrageM() })()`)
  }
  const t0 = Date.now()
  while (Date.now() - t0 < 90000 && !(await p.evaluer(`(() => { const e = window.__exp; return !e.modes.busy && (!e.globe.tuilesEnVol || e.globe.tuilesEnVol() === 0) })()`))) await dors(250)
  await dors(4000)
  const t1 = Date.now()
  while (Date.now() - t1 < 60000 && !(await p.evaluer(`(() => { const e = window.__exp; return !e.globe.tuilesEnVol || e.globe.tuilesEnVol() === 0 })()`))) await dors(250)
  await dors(1500)
}

async function scenarioPixel(p) {
  fs.mkdirSync(DOSSIER, { recursive: true })
  const etiquette = (URL_SUFFIXE || 'apres').replace(/[^a-z0-9=&]/gi, '').replace(/&/g, '_').replace(/=/g, '-') || 'apres'
  const out = {}
  for (const poste of POSTES) {
    await poserPoste(p, poste)
    const r = await p.evaluer(`(() => { const e = window.__exp; e.params.animations = false; e.aq.setTier(0, true)
      const gl = e.renderer.getContext(); const w = gl.drawingBufferWidth, h = gl.drawingBufferHeight
      if (e.majCameraFond) e.majCameraFond()
      e.composer.render(0); e.composer.render(0)
      const px = new Uint8Array(w * h * 4); gl.readPixels(0, 0, w, h, gl.RGBA, gl.UNSIGNED_BYTE, px)
      let s = 0; for (let i = 0; i < px.length; i += 7) s = (s * 31 + px[i]) >>> 0
      let bin = ''; for (let i = 0; i < px.length; i += 8192) bin += String.fromCharCode.apply(null, px.subarray(i, i + 8192))
      let tuiles = 0, vis = 0; e.globe.group.traverse((o) => { if (o.isMesh && o.userData && (o.userData.tuile || (o.material && o.material.uniforms && o.material.uniforms.uTex))) { tuiles++; if (o.visible) vis++ } })
      return { w, h, hash: s, mode: e.modes.mode, altG: ((e.camGlobe || e.camera).position.length() - 100) * 63710, altCadrage: e.altitudeCadrageM ? e.altitudeCadrageM() : null, tuiles, vis, appels: e.renderer.info.render.calls, b64: btoa(bin) } })()`)
    const fichier = path.join(DOSSIER, `${poste}-${etiquette}.rgba`)
    fs.writeFileSync(fichier, Buffer.from(r.b64, 'base64'))
    delete r.b64
    out[poste] = { ...r, fichier }
    console.log(`  ${poste} : ${r.w}×${r.h} hash ${r.hash} · mode ${r.mode} · alt ${Math.round(r.altG / 1000)} km (cadrage ${r.altCadrage && Math.round(r.altCadrage)}) · tuiles ${r.vis}/${r.tuiles} → ${fichier}`)
  }
  return out
}

async function scenarioFuites(p) {
  await p.evaluer(SONDE)
  const ecouteurs = async () => {
    const out = {}
    for (const expr of ['window', 'document', 'window.__exp.renderer.domElement']) {
      const { result } = await p.cdp.send('Runtime.evaluate', { expression: expr }, p.s)
      const { listeners } = await p.cdp.send('DOMDebugger.getEventListeners', { objectId: result.objectId }, p.s)
      out[expr.replace('window.__exp.renderer.domElement', 'canvas')] = listeners.length
    }
    return out
  }
  const releve = async (etiq) => ({ etiq, ...(await p.evaluer(`({ memoire: { ...window.__exp.renderer.info.memory, programmes: window.__exp.renderer.info.programs.length }, tas: +(performance.memory.usedJSHeapSize / 1048576).toFixed(1), dem: window.__exp.params.demLocation })`)), ecouteurs: await ecouteurs() })
  const lieux = ['Chamonix', 'Annecy', 'Nice', 'Chamonix', 'Annecy', 'Nice']
  const serie = [await releve('départ')]
  for (const l of lieux) {
    const ok = await p.evaluer(`window.__exp.gotoCtl.go(${JSON.stringify(l)}).then(() => true).catch((e) => 'échec ' + e.message)`)
    // attendre la fin de construction du relief
    const t0 = Date.now()
    while (Date.now() - t0 < 40000) { await dors(500); if (await p.evaluer(`!window.__exp.modes.busy && !document.getElementById('loading')?.classList.contains('hidden') === false`)) break }
    await dors(3000)
    serie.push({ ...(await releve(l)), go: ok })
  }
  return { serie }
}

// ------------------------------------------------------------------ main
if (COMPARER) {
  const [fa, fb] = COMPARER
  const a = fs.readFileSync(fa), b = fs.readFileSync(fb)
  if (a.length !== b.length) { console.log(JSON.stringify({ identiques: false, raison: 'tailles différentes', a: a.length, b: b.length })); process.exit(0) }
  let pixelsDiff = 0, maxDelta = 0, somme = 0
  for (let i = 0; i < a.length; i += 4) {
    let d = 0
    for (let c = 0; c < 3; c++) d = Math.max(d, Math.abs(a[i + c] - b[i + c]))
    if (d > 0) { pixelsDiff++; somme += d; if (d > maxDelta) maxDelta = d }
  }
  const n = a.length / 4
  console.log(JSON.stringify({ identiques: pixelsDiff === 0, pixels: n, pixelsDifferents: pixelsDiff, part: +(pixelsDiff / n * 100).toFixed(3) + ' %', maxDelta, deltaMoyen: pixelsDiff ? +(somme / pixelsDiff).toFixed(2) : 0 }))
  process.exit(0)
}
const p = await ouvrirPage()
console.log(`Chrome ${p.version} · ${LARGEUR}×${HAUTEUR} dpr ${DPR} · CPU ×${CPU}${SWIFT ? ' · SwiftShader' : ''} · scénario ${SCENARIO}`)
let resultat
try {
  await p.naviguer(`http://127.0.0.1:${PORT}/${URL_SUFFIXE}`)
  const tPret = await attendrePret(p)
  console.log(`  premier dessin après ${tPret} ms`)
  if (SCENARIO === 'voile') {
    // le voile monte APRÈS le chargement : on l'attend
    const t0 = Date.now()
    while (Date.now() - t0 < 20000 && !(await p.evaluer(`document.body.classList.contains('ce-hub')`))) await dors(250)
    await p.evaluer(SONDE)
    resultat = { glisse: await scenarioVoile(p) }
    // recharger pour la croix, puis pour le double-clic
    for (const [nom, f] of [['croix', scenarioVoileCroix], ['doubleClic', scenarioVoileDouble]]) {
      await p.naviguer(`http://127.0.0.1:${PORT}/${URL_SUFFIXE}`)
      await attendrePret(p)
      const t1 = Date.now()
      while (Date.now() - t1 < 20000 && !(await p.evaluer(`document.body.classList.contains('ce-hub')`))) await dors(250)
      await p.evaluer(SONDE)
      resultat[nom] = await f(p)
    }
  } else if (SCENARIO === 'palier') {
    resultat = await scenarioPalier(p, tPret)
  } else {
    // le voile d'accueil monte après le chargement : on l'attend puis on le ferme
    const t0 = Date.now()
    while (Date.now() - t0 < 15000 && !(await p.evaluer(`document.body.classList.contains('ce-hub')`))) await dors(250)
    const ferme = await fermerVoile(p)
    console.log(`  voile fermé : ${ferme}`)
    if (ORBITE) {
      await p.evaluer(`window.__exp.modes.enterOrbit(${ALTITUDE > 0 ? ALTITUDE : 'null'})`)
      const t1 = Date.now()
      while (Date.now() - t1 < 30000 && !(await p.evaluer(`window.__exp.modes.mode === 'orbital' && !window.__exp.modes.busy`))) await dors(250)
      await dors(1500)
      console.log(`  orbite : ${await p.evaluer(`window.__exp.modes.mode`)}`)
    }
    console.log(`  immobile après ${await attendreImmobile(p)} ms`)
    const etat = await p.evaluer(ETAT)
    console.log(`  palier machine ${etat.palierMachine?.palier} (${etat.palierMachine?.carte}, écran ${etat.palierMachine?.ecran}) · palier ${etat.palier} · mode ${etat.mode} · alt ${Math.round(etat.altG / 1000)} km · dpr rendu ${etat.pixelRatio} · passes ${etat.passes.join(' → ')}`)
    if (SCENARIO === 'gl') resultat = await scenarioGl(p)
    else if (SCENARIO === 'repos') resultat = await scenarioRepos(p)
    else if (SCENARIO === 'palier') resultat = await scenarioPalier(p, tPret)
    else if (SCENARIO === 'clic') resultat = await scenarioClic(p)
    else if (SCENARIO === 'fuites') resultat = await scenarioFuites(p)
    else if (SCENARIO === 'pixel') resultat = await scenarioPixel(p)
    else throw new Error('scénario inconnu : ' + SCENARIO)
    resultat.etatDepart = etat
  }
  resultat.exceptionsPage = p.journal.filter((j) => j.quoi === 'exception').map((j) => j.texte).slice(0, 10)
  resultat.erreursConsole = p.journal.filter((j) => j.niveau === 'error' && j.quoi === 'console').map((j) => j.texte).slice(0, 10)
  console.log(JSON.stringify(resultat, null, 1))
  if (SORTIE) { fs.mkdirSync(path.dirname(SORTIE), { recursive: true }); fs.writeFileSync(SORTIE, JSON.stringify({ scenario: SCENARIO, banc: { port: PORT, url: URL_SUFFIXE, cpu: CPU, dpr: DPR, taille: [LARGEUR, HAUTEUR], swiftshader: SWIFT, chrome: p.version }, resultat }, null, 1)) }
} finally {
  await p.fermer()
}
