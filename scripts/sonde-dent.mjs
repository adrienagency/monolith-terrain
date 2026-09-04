// SONDE DENT — LA MESURE LÉGUÉE PAR VID, PUIS LES DEUX SYMPTÔMES SÉPARÉS.
//
// ① la BOÎTE ENGLOBANTE de la calotte contre celle des parois, à Rodrigues.
//    ⚠️ Piège nommé par VID : `_mer` repasse à `null` dès qu'on quitte le crop.
//    On relève DEDANS, dans la même évaluation que la pose.
// ② les ENCOCHES du bord : silhouette de la nappe au GPU (A/B `mer.visible`),
//    puis, pour chaque colonne de l'image, le pixel de mer le plus bas — l'écart
//    pic-à-creux de cette courbe EST la denture, en pixels.
//
// EMPLOI : npx vite --host 127.0.0.1 --port 9433
//          node scripts/sonde-dent.mjs --port 9433 --etiquette AVANT
import fs from 'node:fs'
import path from 'node:path'
import { fileURLToPath } from 'node:url'

const RACINE = path.dirname(path.dirname(fileURLToPath(import.meta.url)))
const ICI = path.join(RACINE, '.banc', 'DENT')
fs.mkdirSync(ICI, { recursive: true })
const A = process.argv.slice(2)
const opt = (n, d) => { const i = A.indexOf(n); return i >= 0 && A[i + 1] !== undefined ? A[i + 1] : d }
const PORT = Number(opt('--port', '9433'))
const ETIQ = opt('--etiquette', 'DENT')
const LIEU = opt('--lieu', '-19.7253, 63.3691')
const ZOOM = Number(opt('--zoom', '11'))
const ALTS = opt('--alts', '32849').split(',').map(Number)
const ELEV = Number(opt('--elevation', '34'))
const AZIM = Number(opt('--azimut', '45'))
const CAPTURE = opt('--capture', '')
const W = 1280, H = 800
const CX = W / 2, CY = H / 2

const pup = (await import('file:///C:/Dev/wt-f3/node_modules/puppeteer-core/lib/puppeteer/puppeteer-core.js')).default
const nav = await pup.launch({
  executablePath: 'C:/Program Files/Google/Chrome/Application/chrome.exe',
  headless: 'new',
  args: [`--window-size=${W},${H + 120}`, '--use-angle=default', '--disable-frame-rate-limit', '--disable-gpu-vsync'],
  defaultViewport: { width: W, height: H },
})
let page = (await nav.pages())[0]
const dodo = (ms) => new Promise((r) => setTimeout(r, ms))
const T0 = Date.now()
const etape = (m) => console.log(`[${((Date.now() - T0) / 1000).toFixed(0)} s] ${m}`)

async function neuf() {
  await page.goto(`http://127.0.0.1:${PORT}/`, { waitUntil: 'domcontentloaded', timeout: 90000 })
  await page.waitForFunction('!!(window.__exp && window.__exp.globe && window.__exp.modes)', { timeout: 120000 })
  await page.waitForFunction("!!document.getElementById('loading')?.classList.contains('hidden')", { timeout: 180000 })
  for (let k = 0; k < 8; k++) {
    await page.keyboard.press('Escape').catch(() => {})
    await dodo(200)
    const sous = await page.evaluate(([x, y]) => document.elementFromPoint(x, y)?.tagName ?? null, [CX, CY])
    if (sous === 'CANVAS') break
  }
  await page.evaluate(() => { document.body.classList.remove('ce-hub'); document.querySelector('.ce-hubveil')?.remove() })
  await page.waitForFunction('!(window.__exp.modes && (window.__exp.modes.busy || window.__exp.modes.travel))', { timeout: 60000, polling: 200 }).catch(() => {})
  await dodo(2500)
}

const wait = (n) => page.evaluate((k) => new Promise((r) => { let i = 0; const t = () => (++i >= k ? r() : requestAnimationFrame(t)); requestAnimationFrame(t) }), n)

// ⚡ **LA POSE DE LA VIDÉO SE PREND PAR LE ZOOM, PAS PAR LA CAMÉRA.**
// `gotoCtl.go` atterrit au zoom FIN (z16) : `uCropDemi` y vaut 2,29e-5, soit
// **32 fois plus serré que la vidéo d'Adrien** (7,32e-4 = z11), et aucune
// molette ne l'en sort — `sortie-molette.js` exige TROIS crans en moins d'une
// seconde (FENETRE_SORTIE_MS), et sortir tue le crop de toute façon.
// `modes.flyTo(lat, lon, zoom)` rend le `uCropDemi` de la vidéo AU BIT PRÈS.
async function aller(lieu, zoom) {
  const [lat, lon] = lieu.split(',').map(Number)
  await page.evaluate(([a, b, z]) => window.__exp.modes.flyTo(a, b, z), [lat, lon, zoom])
  await dodo(6000)
  await page.waitForFunction('!(window.__exp.modes && (window.__exp.modes.busy || window.__exp.modes.travel))', { timeout: 120000, polling: 300 }).catch(() => {})
  await dodo(3000)
}

// ⚠️ LA POSE DE LA VIDÉO SE PREND À LA MOLETTE, PAS À LA CAMÉRA. `uCropDemi`
// est un palier de zoom : déplacer la caméra change `altitudeCadrageM` sans le
// bouger d'un bit (relevé : alt 32 962 m avec uCropDemi = 2,29e-5, soit 32 fois
// plus serré que la vidéo). ⛔ La molette ne passe pas par `computer:scroll` :
// le voile `.ce-elemwrap` l'avale — on la poste sur la toile.
async function molette(n, sens) {
  for (let i = 0; i < n; i++) {
    await page.evaluate((dy) => {
      const cv = window.__exp.renderer.domElement, r = cv.getBoundingClientRect()
      cv.dispatchEvent(new WheelEvent('wheel', { deltaY: dy, clientX: r.left + r.width / 2, clientY: r.top + r.height / 2, bubbles: true, cancelable: true }))
    }, sens)
    await dodo(700)
  }
  await dodo(2000)
}

async function poserCropDemi(cible) {
  for (let k = 0; k < 24; k++) {
    const d = await page.evaluate(() => window.__exp.globe.uniforms.uCropDemi.value)
    if (Math.abs(d - cible) / cible < 0.01) return d
    // ⚠️ SIGNE MESURÉ, PAS SUPPOSÉ : deltaY = +120 fait DESCENDRE l'altitude
    // (32 962 m → 1 288 m en 24 crans). Sortir, donc élargir le crop, c'est −120.
    await molette(1, d < cible ? -120 : 120)
  }
  return page.evaluate(() => window.__exp.globe.uniforms.uCropDemi.value)
}

async function porter(altM) {
  await page.evaluate(async (a) => {
    const e = window.__exp
    const cam = e.camera, ct = e.controls
    ct.minDistance = 1e-4; ct.maxDistance = 1e12
    const dir = cam.position.clone().sub(ct.target).normalize()
    for (let i = 0; i < 60; i++) {
      const v = e.altitudeCadrageM()
      if (!Number.isFinite(v) || v <= 0) break
      const d = cam.position.distanceTo(ct.target)
      const nd = d * (a / v)
      if (!Number.isFinite(nd) || nd <= 0) break
      cam.position.copy(ct.target).addScaledVector(dir, nd)
      ct.update?.()
      if (Math.abs(e.altitudeCadrageM() - a) / a < 0.004) break
    }
  }, altM)
  await wait(10)
  await dodo(2500)
}

async function incliner(elevDeg, azDeg) {
  await page.evaluate(([el, az]) => {
    const e = window.__exp, cam = e.camera, ct = e.controls
    const d = cam.position.distanceTo(ct.target)
    const p = (el * Math.PI) / 180, a = (az * Math.PI) / 180
    cam.position.set(
      ct.target.x + d * Math.cos(p) * Math.sin(a),
      ct.target.y + d * Math.sin(p),
      ct.target.z + d * Math.cos(p) * Math.cos(a)
    )
    cam.lookAt(ct.target)
    ct.update?.()
  }, [elevDeg, azDeg])
  await wait(6)
  await dodo(1500)
}

async function stabiliser(essais = 30) {
  const signature = () => page.evaluate(() => {
    const g = window.__exp.globe
    return JSON.stringify({ mer: !!g._mer, compte: g._merEtat?.compte ?? null, tuiles: g.tiles?.size ?? null, busy: !!window.__exp.modes.busy })
  })
  let prec = null, stables = 0
  for (let i = 0; i < essais; i++) {
    const s = await signature().catch(() => null)
    if (s === null) { await dodo(1500); stables = 0; continue }
    if (s === prec) { if (++stables >= 2) return true } else { stables = 0 }
    prec = s
    await dodo(700)
  }
  return false
}

// ══════════ ① LA MESURE LÉGUÉE — LES DEUX BOÎTES, DANS LE MÊME REPÈRE ════════
//
// ⚠️ TROIS ESPACES DE COORDONNÉES (bloc 56, globe R=100, caméra d'effets). On
// prend les DEUX boîtes en MONDE (`matrixWorld` appliquée) : c'est le seul
// repère où « la calotte contre les parois » a un sens, et il est le même pour
// les deux meshes puisque tous deux pendent de `globe.group`.
const BOITES = `(() => {
  const e = window.__exp, g = e.globe
  const mer = g._mer, par = g._parois
  if (!mer) return { refus: 'pas de nappe (_mer null) — on a quitte le crop' }
  if (!par) return { refus: 'pas de parois' }
  const et = g._merEtat || {}
  const nCal = (et.compte && et.compte.sommets) || 0
  const boite = (mesh, deb, fin) => {
    const p = mesh.geometry.getAttribute('position')
    const a = deb === undefined ? 0 : deb
    const b = fin === undefined ? p.count : Math.min(fin, p.count)
    const v = new (window.THREE ? window.THREE.Vector3 : Object)()
    let mnx = Infinity, mny = Infinity, mnz = Infinity, mxx = -Infinity, mxy = -Infinity, mxz = -Infinity
    const m = mesh.matrixWorld.elements
    for (let i = a; i < b; i++) {
      const x = p.getX(i), y = p.getY(i), z = p.getZ(i)
      const w = m[3] * x + m[7] * y + m[11] * z + m[15] || 1
      const X = (m[0] * x + m[4] * y + m[8] * z + m[12]) / w
      const Y = (m[1] * x + m[5] * y + m[9] * z + m[13]) / w
      const Z = (m[2] * x + m[6] * y + m[10] * z + m[14]) / w
      if (X < mnx) mnx = X; if (X > mxx) mxx = X
      if (Y < mny) mny = Y; if (Y > mxy) mxy = Y
      if (Z < mnz) mnz = Z; if (Z > mxz) mxz = Z
    }
    return { min: [mnx, mny, mnz], max: [mxx, mxy, mxz], taille: [mxx - mnx, mxy - mny, mxz - mnz], sommets: b - a }
  }
  const calotte = boite(mer, 0, nCal || undefined)
  const nappeEtJupe = boite(mer)
  const parois = boite(par)
  // le RATIO que VID demande : cote horizontal de la calotte / cote des parois
  const hCal = Math.max(calotte.taille[0], calotte.taille[2])
  const hPar = Math.max(parois.taille[0], parois.taille[2])
  // les bornes en aCrop reellement portees par le tampon
  const aC = mer.geometry.getAttribute('aCrop')
  let umax = 0
  for (let i = 0; i < (nCal || aC.count); i++) {
    const u = Math.abs(aC.getX(i)), v = Math.abs(aC.getY(i))
    if (u > umax) umax = u; if (v > umax) umax = v
  }
  const U = g.uniforms
  return {
    calotte, nappeEtJupe, parois,
    ratio: hPar > 0 ? hCal / hPar : null,
    hCal, hPar,
    aCropMax: umax,
    merEtat: { compte: et.compte || null, couverture: et.couverture || null, jupe: et.jupe },
    uniformes: {
      uCropDemi: U.uCropDemi.value, uCropOn: U.uCropOn.value,
      uCropCoin: U.uCropCoin.value, uCropCoinN: U.uCropCoinN.value,
      uCropCentre: U.uCropCentre ? [U.uCropCentre.value.x, U.uCropCentre.value.y] : null,
      uMerBord: [mer.material.uniforms.uMerBord.value.x, mer.material.uniforms.uMerBord.value.y],
      uMerBandeHoule: mer.material.uniforms.uMerBandeHoule.value,
      uMerPortee: mer.material.uniforms.uMerPortee.value,
      uMerDebut: mer.material.uniforms.uMerDebut.value,
      uMerFin: mer.material.uniforms.uMerFin.value,
      uMerHoule: mer.material.uniforms.uMerHoule.value,
      uMerChop: mer.material.uniforms.uMerChop.value,
    },
    altitudeM: e.altitudeCadrageM(),
  }
})()`

// ══════════ ② LA DENTURE — silhouette au GPU, puis le profil du bord ═════════
//
// ⛔ Une sonde qui lit la trame COMPOSÉE voit l'écume par-dessus : on fait un
// A/B `mer.visible` sur la MÊME image, au GPU, dans la même tâche que le rendu.
const DENTURE = `(() => {
  const e = window.__exp, g = e.globe, mer = g._mer
  if (!mer) return { refus: 'pas de nappe' }
  const gl = e.renderer.getContext()
  const w = gl.drawingBufferWidth, h = gl.drawingBufferHeight
  const lire = () => {
    const buf = new Uint8Array(w * h * 4)
    gl.bindFramebuffer(gl.FRAMEBUFFER, null)
    gl.readPixels(0, 0, w, h, gl.RGBA, gl.UNSIGNED_BYTE, buf)
    return buf
  }
  const rendre = () => { if (e.composer) e.composer.render(); else e.renderer.render(e.scene, e.camera) }
  mer.visible = true; rendre(); const A = lire()
  mer.visible = false; rendre(); const B = lire()
  mer.visible = true; rendre()
  // masque : pixel ou la nappe change quelque chose
  const masque = new Uint8Array(w * h)
  let n = 0
  for (let i = 0; i < w * h; i++) {
    const d = Math.abs(A[i*4] - B[i*4]) + Math.abs(A[i*4+1] - B[i*4+1]) + Math.abs(A[i*4+2] - B[i*4+2])
    if (d > 12) { masque[i] = 1; n++ }
  }
  if (n < 500) return { refus: 'silhouette trop petite: ' + n }
  // profil du BORD BAS (readPixels : y=0 en bas de l ecran, donc « bas » = y min)
  const bas = new Int32Array(w).fill(-1)
  const haut = new Int32Array(w).fill(-1)
  for (let x = 0; x < w; x++) {
    for (let y = 0; y < h; y++) if (masque[y * w + x]) { bas[x] = y; break }
    for (let y = h - 1; y >= 0; y--) if (masque[y * w + x]) { haut[x] = y; break }
  }
  // la DENTURE : sur une portion CONTINUE du bord, l ecart d une colonne a la
  // suivante contre la tendance locale. Une droite oblique a une pente
  // constante ; une dent la fait osciller. On mesure l ecart pic-a-creux du
  // residu apres retrait d une regression lineaire glissante (fenetre 41 px).
  const denture = (prof) => {
    const xs = []
    for (let x = 0; x < w; x++) if (prof[x] >= 0) xs.push(x)
    if (xs.length < 80) return null
    let pire = 0, pireX = -1
    const F = 20
    let resAbs = 0, nres = 0
    for (let k = F; k < xs.length - F; k++) {
      // contigu ?
      if (xs[k + F] - xs[k - F] !== 2 * F) continue
      let sx = 0, sy = 0, sxx = 0, sxy = 0, m = 0
      for (let j = k - F; j <= k + F; j++) { const X = xs[j], Y = prof[X]; sx += X; sy += Y; sxx += X * X; sxy += X * Y; m++ }
      const den = m * sxx - sx * sx
      if (!den) continue
      const a = (m * sxy - sx * sy) / den, b = (sy - a * sx) / m
      let mn = Infinity, mx = -Infinity
      for (let j = k - F; j <= k + F; j++) { const X = xs[j], r = prof[X] - (a * X + b); if (r < mn) mn = r; if (r > mx) mx = r; }
      resAbs += mx - mn; nres++
      if (mx - mn > pire) { pire = mx - mn; pireX = xs[k] }
    }
    return { pirePicACreux: pire, x: pireX, moyenPicACreux: nres ? resAbs / nres : null, colonnes: xs.length }
  }
  return { pixels: n, largeur: w, hauteur: h, bordBas: denture(bas), bordHaut: denture(haut) }
})()`

const releves = []
await neuf()
etape('page prete')
await aller(LIEU, ZOOM)
etape('a ' + LIEU)
await incliner(ELEV, AZIM)
const CIBLE_DEMI = Number(opt('--cropdemi', '0'))
if (CIBLE_DEMI > 0) {
  const d = await poserCropDemi(CIBLE_DEMI)
  etape(`uCropDemi posé à ${d} (cible ${CIBLE_DEMI})`)
  await stabiliser()
}
for (const alt of ALTS) {
  if (Number.isFinite(alt) && alt > 0) await porter(alt)
  await incliner(ELEV, AZIM)
  await stabiliser()
  const b = await page.evaluate(BOITES)
  const d = await page.evaluate(DENTURE)
  const r = { lieu: LIEU, altitudeVisee: alt, boites: b, denture: d }
  releves.push(r)
  etape(`alt ${alt} → ` + JSON.stringify(b.refus ? b : { ratio: b.ratio, hCal: b.hCal, hPar: b.hPar, aCropMax: b.aCropMax, alt: b.altitudeM }))
  etape(`   denture → ` + JSON.stringify(d))
  if (CAPTURE) {
    fs.mkdirSync(CAPTURE, { recursive: true })
    await page.screenshot({ path: path.join(CAPTURE, `${ETIQ}-${alt}.png`) })
  }
}
fs.writeFileSync(path.join(ICI, `${ETIQ}.json`), JSON.stringify(releves, null, 2))
etape(`écrit ${path.join(ICI, ETIQ + '.json')}`)
await nav.close()
