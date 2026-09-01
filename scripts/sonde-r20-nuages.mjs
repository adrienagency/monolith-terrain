// SONDE R20 — L'INVENTAIRE DES DEUX SYSTÈMES DE NUAGES, PROUVÉ À L'ÉCRAN.
//
// ⛔ Elle ne lit PAS le code : elle déplace une valeur dans les deux sens et
// mesure l'image. L'instrument est celui de R18 (condensé 256 × 160 + gradient
// local), parce qu'une moyenne de boîte grossière annule un motif fin.
//
// Trois altitudes, trois questions par altitude :
//   ① où vivent les deux objets, dans quelle scène, visibles ou non ;
//   ② la coquille du globe : allumée / éteinte → écart à l'écran ;
//   ③ le volume clouds2 : forcé visible / caché → écart à l'écran.
import fs from 'node:fs'
import path from 'node:path'
import { fileURLToPath } from 'node:url'

const RACINE = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..')
const args = process.argv.slice(2)
const opt = (n, d = null) => { const i = args.indexOf(n); return i >= 0 && args[i + 1] ? args[i + 1] : d }
const PORT = Number(opt('--port', '5565'))
const SORTIE = opt('--sortie', path.join(RACINE, '.banc/R20'))
fs.mkdirSync(SORTIE, { recursive: true })

function trouverChrome() {
  const p = ['C:/Program Files/Google/Chrome/Application/chrome.exe', 'C:/Program Files (x86)/Google/Chrome/Application/chrome.exe', '/usr/bin/google-chrome'].find((x) => fs.existsSync(x))
  if (!p) { console.error('Chrome introuvable'); process.exit(2) }
  return p
}
async function chargerPuppeteer() {
  for (const p of [path.join(RACINE, 'node_modules/puppeteer-core/lib/puppeteer/puppeteer-core.js'),
    'C:/Dev/wt-f3/node_modules/puppeteer-core/lib/puppeteer/puppeteer-core.js',
    'C:/Dev/wt-warm/node_modules/puppeteer-core/lib/puppeteer/puppeteer-core.js',
    'C:/Dev/monolith-terrain/node_modules/puppeteer-core/lib/puppeteer/puppeteer-core.js']) {
    if (fs.existsSync(p)) return (await import('file:///' + p.replace(/\\/g, '/'))).default
  }
  console.error('puppeteer-core introuvable'); process.exit(2)
}
const dodo = (ms) => new Promise((r) => setTimeout(r, ms))

// ══════════ L'INSTRUMENT, POSÉ DANS LA PAGE ═════════════════════════════════
// Identique à celui de R18 : condensé 256 × 160 par blits successifs (vraie
// moyenne de boîte), puis DEUX grandeurs — moyenne et gradient local.
function poserInstrument() {
  const e = window.__exp
  const R = e.renderer
  const CV = R.domElement
  const gl = R.getContext()
  const LARG = 256, HAUT = 160
  const etages = []
  function construireEtages() {
    for (const et of etages) { gl.deleteFramebuffer(et.fbo); gl.deleteRenderbuffer(et.rb) }
    etages.length = 0
    let w = CV.width, h = CV.height
    for (let i = 0; i < 12; i++) {
      const nw = Math.max(LARG, Math.floor(w / 2)), nh = Math.max(HAUT, Math.floor(h / 2))
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
    const t = new Float32Array(LARG * HAUT * 3)
    for (let i = 0, j = 0; i < LARG * HAUT; i++) { t[j++] = px[i * 4]; t[j++] = px[i * 4 + 1]; t[j++] = px[i * 4 + 2] }
    return t
  }
  const N = LARG * HAUT * 3
  const etat = { n: 0, slots: {}, LARG, HAUT }
  window.__r20 = etat
  const tampon = []
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
  function boucle() {
    try { tampon.push(condense()); if (tampon.length > 24) tampon.shift(); etat.n++ }
    catch (err) { etat.erreur = String(err).slice(0, 140) }
    requestAnimationFrame(boucle)
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
  executablePath: trouverChrome(), headless: true,
  args: ['--headless=new', '--no-sandbox', '--enable-unsafe-swiftshader', '--window-size=1280,900'],
})
const out = { port: PORT, quand: new Date().toISOString() }
try {
  const page = await nav.newPage()
  await page.setViewport({ width: 1280, height: 800 })
  await page.evaluateOnNewDocument(() => { try { localStorage.setItem('shibumap-ui-advanced', '1'); localStorage.setItem('shibumap-workmode', 'studio') } catch {} })
  await page.goto(`http://localhost:${PORT}/`, { waitUntil: 'domcontentloaded', timeout: 120000 })
  await page.waitForFunction(() => window.__exp?.globe && window.__exp?.composer, { timeout: 90000, polling: 100 })
  await dodo(12000)
  await page.keyboard.press('Escape')
  await dodo(2500)

  // ⚠️ LE MOUVEMENT AMBIANT COUPÉ, SINON LE PLANCHER DE BRUIT NOIE TOUT.
  // ⛔ Et il coupe AUSSI la rotation solitaire du globe (dtAmb), donc les
  // captures ne dérivent plus vers l'Ukraine en croyant viser la Suisse.
  await page.evaluate(() => { window.__exp.params.animations = false })
  await dodo(1500)
  await page.evaluate(poserInstrument)
  await dodo(1200)

  // ══════════ ÉTAT DE DÉPART, ET LES DEUX OBJETS ═══════════════════════════
  out.depart = await page.evaluate(() => {
    const e = window.__exp
    const chemin = (o) => { const n = []; let p = o; while (p) { n.unshift(p.name || p.type); p = p.parent } return n.join('/') }
    const visEff = (o) => { let v = o.visible, p = o.parent; while (v && p) { v = p.visible; p = p.parent } return v }
    const g2 = e.clouds?.group || e.clouds?.mesh || null
    const gs = e.globe?.clouds?.group || null
    return {
      mode: e.modes?.mode, terreUnique: e.terreUniqueBranchee, frontiere: e.frontiereActive,
      altM: Math.round(e.altitudeCadrageM?.() ?? -1),
      camDist: +e.camera.position.length().toFixed(3),
      camGlobeDist: +(e.camGlobe?.position.length() ?? 0).toFixed(3),
      cloudsEnabled: e.params.cloudsEnabled,
      clouds2: g2 ? { chemin: chemin(g2), visible: g2.visible, visibleEffectif: visEff(g2), enfants: g2.children.length } : null,
      coquille: gs ? { chemin: chemin(gs), visible: gs.visible, visibleEffectif: visEff(gs), enfants: gs.children.length, uFade: +e.globe.clouds.uniforms.uFade.value.toFixed(4), rayon: e.globe.clouds.radius } : null,
      unitesTexture: (() => { try { const gl = e.renderer.getContext(); return gl.getParameter(gl.MAX_TEXTURE_IMAGE_UNITS) } catch { return null } })(),
    }
  })
  console.log('départ :', JSON.stringify(out.depart, null, 1))

  // ══════════ LA MANŒUVRE D'ALTITUDE ═══════════════════════════════════════
  // On multiplie la position de la caméra du BLOC : c'est elle que la machine à
  // modes lit, et `majCameraFond` en dérive la caméra du globe.
  const monter = async (k) => {
    await page.evaluate((kk) => {
      const e = window.__exp
      e.camera.position.multiplyScalar(kk)
      e.controls?.update?.()
    }, k)
    await dodo(6000)
  }

  const releve = async (nom) => {
    const info = await page.evaluate(() => {
      const e = window.__exp
      const visEff = (o) => { let v = o.visible, p = o.parent; while (v && p) { v = p.visible; p = p.parent } return v }
      const g2 = e.clouds?.group || e.clouds?.mesh || null
      const gs = e.globe?.clouds?.group || null
      return {
        mode: e.modes?.mode,
        altM: Math.round(e.altitudeCadrageM?.() ?? -1),
        camDist: +e.camera.position.length().toFixed(3),
        camGlobeDist: +(e.camGlobe?.position.length() ?? 0).toFixed(3),
        uFade: gs ? +e.globe.clouds.uniforms.uFade.value.toFixed(4) : null,
        coquilleVisible: gs ? visEff(gs) : null,
        clouds2Visible: g2 ? visEff(g2) : null,
        clouds2Enfants: g2 ? g2.children.length : null,
      }
    })

    // ② LA COQUILLE, DANS LES DEUX SENS
    await page.evaluate(() => window.__r20.vider())
    await page.waitForFunction(() => window.__r20.pret(6), { timeout: 20000, polling: 60 })
    await page.evaluate(() => window.__r20.capturer('A', 6))
    await page.evaluate(() => { window.__exp.globe.clouds.setVisible(false) })
    await dodo(700)
    await page.evaluate(() => window.__r20.vider())
    await page.waitForFunction(() => window.__r20.pret(6), { timeout: 20000, polling: 60 })
    await page.evaluate(() => window.__r20.capturer('B', 6))
    await page.evaluate(() => { window.__exp.globe.clouds.setVisible(true) })
    await dodo(700)
    await page.evaluate(() => window.__r20.vider())
    await page.waitForFunction(() => window.__r20.pret(6), { timeout: 20000, polling: 60 })
    await page.evaluate(() => window.__r20.capturer('R', 6))
    info.coquilleEcart = await page.evaluate(() => window.__r20.distance('A', 'B'))
    info.coquilleRetour = await page.evaluate(() => window.__r20.distance('A', 'R'))

    // ③ LE VOLUME clouds2, FORCÉ VISIBLE
    await page.evaluate(() => {
      const e = window.__exp
      e.params.cloudsEnabled = true
      e.clouds.build?.(e.params)
      e.clouds.setVisible(true)
    })
    await dodo(2500)
    await page.evaluate(() => window.__r20.vider())
    await page.waitForFunction(() => window.__r20.pret(6), { timeout: 20000, polling: 60 })
    await page.evaluate(() => window.__r20.capturer('C', 6))
    info.clouds2Force = await page.evaluate(() => {
      const e = window.__exp
      const g2 = e.clouds?.group || e.clouds?.mesh
      return { visible: g2.visible, enfants: g2.children.length, ecart: window.__r20.distance('A', 'C') }
    })
    await page.evaluate(() => { window.__exp.clouds.setVisible(false) })
    await dodo(700)

    out[nom] = info
    console.log(nom, JSON.stringify(info))
    await page.screenshot({ path: path.join(SORTIE, `etape1-${nom}.png`) })
  }

  await releve('surface')
  await monter(6)
  await releve('haute')
  await monter(6)
  await releve('orbite')
} catch (err) {
  out.erreur = String(err?.stack || err)
  console.error(out.erreur)
} finally {
  fs.writeFileSync(path.join(SORTIE, 'etape1-inventaire.json'), JSON.stringify(out, null, 1))
  await nav.close()
}
console.log('→', path.join(SORTIE, 'etape1-inventaire.json'))
