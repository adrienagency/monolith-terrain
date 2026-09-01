// DIAGNOSTIC R19 — pourquoi les courbes de niveau ne se gravent pas sur les
// TERRES du crop.
//
// ⚠️ **L'INSTRUMENT EST CELUI DE R18, REPRIS TEL QUEL** (condensé 256 × 160 par
// chaîne de blits + gradient local) : sans ça le 0,014 de R18 ne serait pas
// comparable au mien, et l'étape 1 du brief ne voudrait rien dire.
//
// ⚠️ **ET LE CHEMIN EST LE CHEMIN RÉEL** : on écrit `params.contourOpacity` ET
// `terrain.mapUniforms.uContourOpacity`, comme le fait le raccourci clavier du
// dépôt (`main.js`, case 'contours'), puis `contexteCrop` → `poserHabillage`
// porte la valeur sur le globe. Écrire l'uniforme du globe à la main serait
// annulé à l'image suivante.
import fs from 'node:fs'
import path from 'node:path'
import { fileURLToPath } from 'node:url'

const RACINE = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..')
const args = process.argv.slice(2)
const opt = (n, d = null) => { const i = args.indexOf(n); return i >= 0 && args[i + 1] ? args[i + 1] : d }
const has = (n) => args.includes(n)
const PORT = Number(opt('--port', '5563'))
const SORTIE = opt('--sortie', path.join(RACINE, '.banc/R19'))
const VISIBLE = has('--visible')
const LARG = 256
const HAUT = 160
const dodo = (ms) => new Promise((r) => setTimeout(r, ms))

function trouverChrome() {
  const donne = opt('--chrome', process.env.CHROME_PATH)
  if (donne) return donne
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

// ══════════ L'INSTRUMENT DE R18, MOT POUR MOT ═══════════════════════════════
function poserInstrument(LARG, HAUT) {
  const e = window.__exp
  if (!e) return 'pas de __exp'
  if (window.__r19) return 'déjà posé'
  const R = e.renderer
  const gl = R.getContext()
  const CV = R.domElement
  const etages = []
  function construireEtages() {
    for (const f of etages) { gl.deleteFramebuffer(f.fbo); gl.deleteRenderbuffer(f.rb) }
    etages.length = 0
    let w = CV.width, h = CV.height
    for (let i = 0; i < 12; i++) {
      const nw = Math.max(LARG, w >> 1)
      const nh = Math.max(HAUT, h >> 1)
      const rb = gl.createRenderbuffer()
      gl.bindRenderbuffer(gl.RENDERBUFFER, rb)
      gl.renderbufferStorage(gl.RENDERBUFFER, gl.RGBA8, nw, nh)
      const fbo = gl.createFramebuffer()
      gl.bindFramebuffer(gl.FRAMEBUFFER, fbo)
      gl.framebufferRenderbuffer(gl.FRAMEBUFFER, gl.COLOR_ATTACHMENT0, gl.RENDERBUFFER, rb)
      etages.push({ fbo, rb, w: nw, h: nh })
      w = nw; h = nh
      if (nw === LARG && nh === HAUT) break
    }
    gl.bindFramebuffer(gl.FRAMEBUFFER, null)
    gl.bindRenderbuffer(gl.RENDERBUFFER, null)
  }
  const px = new Uint8Array(LARG * HAUT * 4)
  function condense() {
    if (!etages.length || etages[0].w * 2 < CV.width) construireEtages()
    let srcFbo = null, sw = CV.width, sh = CV.height
    for (const et of etages) {
      gl.bindFramebuffer(gl.READ_FRAMEBUFFER, srcFbo)
      gl.bindFramebuffer(gl.DRAW_FRAMEBUFFER, et.fbo)
      gl.blitFramebuffer(0, 0, sw, sh, 0, 0, et.w, et.h, gl.COLOR_BUFFER_BIT, gl.LINEAR)
      srcFbo = et.fbo; sw = et.w; sh = et.h
    }
    gl.bindFramebuffer(gl.READ_FRAMEBUFFER, srcFbo)
    gl.readPixels(0, 0, LARG, HAUT, gl.RGBA, gl.UNSIGNED_BYTE, px)
    gl.bindFramebuffer(gl.READ_FRAMEBUFFER, null)
    gl.bindFramebuffer(gl.DRAW_FRAMEBUFFER, null)
    gl.bindFramebuffer(gl.FRAMEBUFFER, null)
    R.resetState?.()
    const t = new Array(LARG * HAUT * 3)
    for (let i = 0, j = 0; i < LARG * HAUT; i++) { t[j++] = px[i * 4]; t[j++] = px[i * 4 + 1]; t[j++] = px[i * 4 + 2] }
    return t
  }
  const N = LARG * HAUT * 3
  const etat = { n: 0, slots: {}, LARG, HAUT }
  window.__r19 = etat
  const tampon = []
  function boucle() {
    try {
      tampon.push(Float32Array.from(condense()))
      if (tampon.length > 24) tampon.shift()
      etat.n++
    } catch (err) { etat.erreur = String(err).slice(0, 120) }
    requestAnimationFrame(boucle)
  }
  function gradientDe(moy) {
    const g = new Float32Array(LARG * HAUT)
    const lum = new Float32Array(LARG * HAUT)
    for (let i = 0; i < LARG * HAUT; i++) lum[i] = 0.299 * moy[i * 3] + 0.587 * moy[i * 3 + 1] + 0.114 * moy[i * 3 + 2]
    for (let y = 0; y < HAUT; y++) for (let x = 0; x < LARG; x++) {
      const i = y * LARG + x
      const dx = x + 1 < LARG ? Math.abs(lum[i + 1] - lum[i]) : 0
      const dy = y + 1 < HAUT ? Math.abs(lum[i + LARG] - lum[i]) : 0
      g[i] = dx + dy
    }
    return g
  }
  etat.vider = () => { tampon.length = 0; etat.n = 0 }
  etat.pret = (k) => tampon.length >= k
  etat.capturer = (nom, k) => {
    const im = tampon.slice(-k)
    const moy = new Float32Array(N)
    for (const t of im) for (let i = 0; i < N; i++) moy[i] += t[i]
    for (let i = 0; i < N; i++) moy[i] /= im.length
    etat.slots[nom] = { moy, grad: gradientDe(moy) }
    return im.length
  }
  etat.distance = (a, b) => {
    const A = etat.slots[a], B = etat.slots[b]
    if (!A || !B) return null
    let sm = 0
    for (let i = 0; i < N; i++) sm += Math.abs(A.moy[i] - B.moy[i])
    let sg = 0
    for (let i = 0; i < LARG * HAUT; i++) sg += Math.abs(A.grad[i] - B.grad[i])
    return { moy: sm / N, grad: sg / (LARG * HAUT) }
  }
  requestAnimationFrame(boucle)
  return 'posé'
}

const puppeteer = await chargerPuppeteer()
const nav = await puppeteer.launch({
  executablePath: trouverChrome(),
  headless: !VISIBLE,
  args: [...(VISIBLE ? [] : ['--headless=new']), '--no-sandbox', '--enable-unsafe-swiftshader', '--window-size=1280,900'],
})
fs.mkdirSync(SORTIE, { recursive: true })
const journal = { port: PORT, essais: [] }
try {
  const page = await nav.newPage()
  await page.setViewport({ width: 1280, height: 800 })
  page.on('pageerror', (er) => console.log('ERREUR PAGE', String(er.message).slice(0, 200)))
  await page.goto(`http://localhost:${PORT}/`, { waitUntil: 'domcontentloaded', timeout: 120000 })
  await page.waitForFunction(() => window.__exp?.globe && window.__exp?.modes, { timeout: 90000, polling: 100 })
  await dodo(11000)
  await page.keyboard.press('Escape')
  await dodo(3000)
  await page.evaluate(poserInstrument, LARG, HAUT)
  // ⚡ LE MOUVEMENT AMBIANT COUPÉ : R18 mesure que le plancher de bruit tombe
  // de 0,3693 à 0,0000. Sans ça, le 0,014 se noie.
  await page.evaluate(() => { window.__exp.params.animations = false })
  await dodo(1500)

  journal.gpu = await page.evaluate(() => {
    const gl = window.__exp.renderer.getContext()
    const d = gl.getExtension('WEBGL_debug_renderer_info')
    return d ? String(gl.getParameter(d.UNMASKED_RENDERER_WEBGL)) : 'inconnu'
  })
  journal.etat = await page.evaluate(() => {
    const e = window.__exp
    const u = e.globe.uniforms
    const l = {}
    for (const k of ['uContourOpacity', 'uContourInterval', 'uContourWeight', 'uHabOn', 'uCropOn',
      'uMppFacteur', 'uResRefM', 'uLandMax', 'uReliefBas', 'uOceanDepth', 'uGraticuleOpacity',
      'uGrainForceM', 'uGrainEchelle', 'uMerZeroSousEau', 'uCoastMaskOn', 'uFondOn', 'uAnalysisOn',
      'uPhotoOn', 'uPhotoMonde', 'uAerialOpacity'])
      l[k] = u[k]?.value?.isColor ? u[k].value.getHexString() : (u[k]?.value ?? null)
    return {
      uniformes: l,
      ink: u.uInk?.value?.getHexString?.() ?? null,
      socle: {
        op: e.terrain?.mapUniforms?.uContourOpacity?.value ?? null,
        iv: e.terrain?.mapUniforms?.uContourInterval?.value ?? null,
        w: e.terrain?.mapUniforms?.uContourWeight?.value ?? null,
      },
      params: { contourOpacity: e.params.contourOpacity, contourInterval: e.params.contourInterval, contourWeight: e.params.contourWeight, contourColor: e.params.contourColor, exaggeration: e.params.exaggeration },
      vue: { lat: e.params.lat, lon: e.params.lon, zoom: e.params.zoom, alt: e.camGlobe?.position?.length?.() ?? null },
    }
  })
  console.log('GPU :', journal.gpu)
  console.log('ÉTAT :', JSON.stringify(journal.etat, null, 1))

  // ══════ ÉTAPE 1 — REPRODUIRE LE 0,014 ════════════════════════════════════
  const essais = [
    ['op0', { op: 0 }],
    ['temoin-op0', { op: 0 }],           // plancher de bruit : deux relevés identiques
    ['op1', { op: 1 }],
    ['op1-int100', { op: 1, iv: 100 }],
    ['op1-int100-grat1', { op: 1, iv: 100, grat: 1 }],
  ]
  for (const [nom, cfg] of essais) {
    await page.evaluate((c) => {
      const e = window.__exp
      e.params.contourOpacity = c.op
      e.terrain.mapUniforms.uContourOpacity.value = c.op
      if (c.iv) { e.params.contourInterval = c.iv; e.terrain.mapUniforms.uContourInterval.value = c.iv }
      if (c.grat != null) window.__r19grat = c.grat
    }, cfg)
    await dodo(2500)
    if (cfg.grat != null) { await page.evaluate((g) => { window.__exp.globe.uniforms.uGraticuleOpacity.value = g }, cfg.grat); await dodo(1200) }
    await page.evaluate(() => window.__r19.vider())
    await page.waitForFunction(() => window.__r19.pret(6), { timeout: 30000, polling: 100 })
    const n = await page.evaluate((nm) => window.__r19.capturer(nm, 6), nom)
    const lu = await page.evaluate(() => {
      const u = window.__exp.globe.uniforms
      return { globeOp: u.uContourOpacity.value, globeIv: u.uContourInterval.value, globeW: u.uContourWeight.value }
    })
    journal.essais.push({ nom, cfg, n, lu })
    await page.screenshot({ path: path.join(SORTIE, `e1-${nom}.png`) })
    console.log('relevé', nom, JSON.stringify(lu))
  }
  const paires = [['op0', 'temoin-op0'], ['op0', 'op1'], ['op0', 'op1-int100'], ['op0', 'op1-int100-grat1'], ['op1', 'op1-int100']]
  journal.distances = {}
  for (const [a, b] of paires) {
    const d = await page.evaluate((x, y) => window.__r19.distance(x, y), a, b)
    journal.distances[`${a} → ${b}`] = d
    console.log(`Δ ${a} → ${b} : moy ${d.moy.toFixed(4)} | grad ${d.grad.toFixed(4)}`)
  }
  fs.writeFileSync(path.join(SORTIE, 'etape1.json'), JSON.stringify(journal, null, 1))
} finally { await nav.close() }
