// SONDE BIS — LE BISEAU DU SOCLE, AVANT / APRÈS, DANS LA MÊME PAGE.
//
// Mission B du 2026-09-05, capture d'Adrien : « jupe de la mer rayée de blanc
// au bord biseauté » (La Réunion, vue isométrique). Adrien a DÉCIDÉ de retirer
// les biseaux et leur retrait ; cette sonde mesure ce que ça change, à la
// pose de sa capture, sur 20 images consécutives, avec un témoin.
//
// Ce qu'elle relève, à chaque poste :
//   ① les BANDES CLAIRES SUR LA JUPE DE LA MER : A/B dans la même image,
//      rideau dessiné / rideau caché (`setDrawRange` sur la calotte seule) ;
//      parmi les pixels que le rideau change, ceux qui sont CLAIRS
//      (min(r,g,b) > seuil). 20 images, `uMerTemps` avancé de 0,137 s.
//   ② les MARQUES SUR LES PAROIS : A/B parois visibles / cachées ; parmi les
//      pixels que le mur change, les clairs et les rouges.
//   ③ le TÉMOIN : deux captures du même état — le plancher de la mesure.
//   ④ la GÉOMÉTRIE publiée : retrait de base, bande de jupe, plancher, bord de
//      mer, largeur du socle (boîte des parois) contre l'emprise de la
//      découpe, en unités de scène ET en fraction.
//   ⑤ une capture PNG du poste (le canevas, rendu dans la même tâche).
//
// ⛔ Pièges tenus : `modes.flyTo(lat, lon, zoom)` (pas de lien profond, pas de
// `gotoCtl.go`), arguments COLLÉS dans la source d'`evaluate`, lecture du
// tampon dans la MÊME tâche que `composer.render(0)`, comptage par DIFFÉRENCE.
//
// EMPLOI : npx vite --host 127.0.0.1 --port 10617
//   node scripts/sonde-bis.mjs --port 10617 --etiquette AVANT --adresse "?biseau=1"
//   node scripts/sonde-bis.mjs --port 10617 --etiquette APRES
//   options : --lieu "-21.115, 55.536" --zoom 11 --alt 26000 --elevation 35
//             --azimut 45 --images 20 --dossier reunion
import fs from 'node:fs'
import path from 'node:path'
import { fileURLToPath } from 'node:url'

const RACINE = path.dirname(path.dirname(fileURLToPath(import.meta.url)))
const A = process.argv.slice(2)
const opt = (n, d) => { const i = A.indexOf(n); return i >= 0 && A[i + 1] !== undefined ? A[i + 1] : d }
const PORT = Number(opt('--port', '10617'))
const ETIQ = opt('--etiquette', 'BIS')
const ADRESSE = opt('--adresse', '')
const LIEU = opt('--lieu', '-21.115, 55.536')
const ZOOM = Number(opt('--zoom', '11'))
const ALT = Number(opt('--alt', '26000'))
const ELEV = Number(opt('--elevation', '35'))
const AZIM = Number(opt('--azimut', '45'))
const IMAGES = Number(opt('--images', '20'))
const DOSSIER = opt('--dossier', 'reunion')
const W = 1280, H = 800
const CX = W / 2, CY = H / 2
const ICI = path.join(RACINE, '.banc', 'BIS', DOSSIER)
fs.mkdirSync(ICI, { recursive: true })

const pup = (await import('file:///C:/Dev/wt-f3/node_modules/puppeteer-core/lib/puppeteer/puppeteer-core.js')).default
const nav = await pup.launch({
  executablePath: 'C:/Program Files/Google/Chrome/Application/chrome.exe',
  headless: 'new',
  args: [`--window-size=${W},${H + 120}`, '--use-angle=default', '--disable-frame-rate-limit', '--disable-gpu-vsync'],
  defaultViewport: { width: W, height: H },
})
const page = (await nav.pages())[0]
const dodo = (ms) => new Promise((r) => setTimeout(r, ms))
const T0 = Date.now()
const etape = (m) => console.log(`[${((Date.now() - T0) / 1000).toFixed(0)} s] ${ETIQ} ${m}`)
const wait = (n) => page.evaluate((k) => new Promise((r) => { let i = 0; const t = () => (++i >= k ? r() : requestAnimationFrame(t)); requestAnimationFrame(t) }), n)

async function neuf() {
  await page.goto(`http://127.0.0.1:${PORT}/${ADRESSE}`, { waitUntil: 'domcontentloaded', timeout: 90000 })
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

async function aller(lieu, zoom) {
  const [lat, lon] = lieu.split(',').map(Number)
  await page.evaluate(([a, b, z]) => window.__exp.modes.flyTo(a, b, z), [lat, lon, zoom])
  await dodo(6000)
  await page.waitForFunction('!(window.__exp.modes && (window.__exp.modes.busy || window.__exp.modes.travel))', { timeout: 120000, polling: 300 }).catch(() => {})
  await dodo(3000)
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

async function stabiliser(essais = 40) {
  const signature = () => page.evaluate(() => {
    const g = window.__exp.globe
    return JSON.stringify({ mer: !!g._mer, parois: !!g._parois, prov: g._parois?.userData?.provisoire ?? null, compte: g._merEtat?.compte ?? null, tuiles: g.tiles?.size ?? null, busy: !!window.__exp.modes.busy })
  })
  let prec = null, stables = 0
  for (let i = 0; i < essais; i++) {
    const s = await signature().catch(() => null)
    if (s === null) { await dodo(1500); stables = 0; continue }
    if (s === prec) { if (++stables >= 3) return true } else { stables = 0 }
    prec = s
    await dodo(700)
  }
  return false
}

// ══════════ LA MESURE, ENTIÈREMENT DANS LA PAGE — arguments COLLÉS ════════════
const MESURE = `(() => {
  const e = window.__exp, g = e.globe, mer = g._mer, par = g._parois
  if (!mer) return { refus: 'pas de nappe (_mer null)' }
  if (!par) return { refus: 'pas de parois' }
  const gl = e.renderer.getContext()
  const w = gl.drawingBufferWidth, h = gl.drawingBufferHeight
  const mu = mer.material.uniforms
  const et = g._merEtat || {}
  const nCal = (et.compte && et.compte.sommets) || 0
  const geo = mer.geometry
  const idx = geo.index
  // le rideau est CONCATÉNÉ après la calotte : ses triangles suivent ceux de
  // la calotte dans l index. On cherche le premier indice qui touche un sommet
  // de rideau (>= nCal).
  let idxCal = idx ? idx.count : 0
  if (idx && nCal > 0) {
    const arr = idx.array
    for (let i = 0; i < arr.length; i++) if (arr[i] >= nCal) { idxCal = i - (i % 3); break }
  }
  const plein = idx ? idx.count : (geo.getAttribute('position').count)
  const cap = () => {
    for (const p of e.composer.passes) if (p.fullscreenMaterial && 'time' in p.fullscreenMaterial) p.fullscreenMaterial.time = 0
    e.composer.render(0)
    const a = new Uint8Array(w * h * 4)
    gl.readPixels(0, 0, w, h, gl.RGBA, gl.UNSIGNED_BYTE, a)
    return a
  }
  const SEUIL_DIFF = 12, SEUIL_CLAIR = ${Number(opt('--clair', '175'))}
  const compte = (A, B) => {
    let change = 0, clairs = 0, rouges = 0
    for (let i = 0; i < A.length; i += 4) {
      const d = Math.max(Math.abs(A[i] - B[i]), Math.abs(A[i + 1] - B[i + 1]), Math.abs(A[i + 2] - B[i + 2]))
      if (d <= SEUIL_DIFF) continue
      change++
      const r = A[i], v = A[i + 1], b = A[i + 2]
      if (Math.min(r, v, b) > SEUIL_CLAIR) clairs++
      if (r > 140 && v < 100 && b < 100) rouges++
    }
    return { change, clairs, rouges }
  }
  const t0 = mu.uMerTemps.value
  // ─── ③ le témoin : même état, deux captures ─────────────────────────────
  const A0 = cap()
  const temoin = compte(A0, cap())
  // ─── ① la jupe de la mer, 20 images ─────────────────────────────────────
  const images = []
  let png = null
  for (let f = 0; f < ${IMAGES}; f++) {
    mu.uMerTemps.value = t0 + f * 0.137
    const A = cap()
    if (f === 0) png = e.renderer.domElement.toDataURL('image/png')
    if (idxCal > 0) geo.setDrawRange(0, idxCal)
    const B = cap()
    geo.setDrawRange(0, plein)
    const jupe = compte(A, B)
    // ─── ② les parois, sur la même image ──────────────────────────────────
    par.visible = false
    const C = cap()
    par.visible = true
    const parois = compte(A, C)
    images.push({ f, jupe, parois })
  }
  mu.uMerTemps.value = t0
  const agg = (k, c) => { const v = images.map((i) => i[k][c]); return { min: Math.min(...v), max: Math.max(...v), moy: +(v.reduce((a, b) => a + b, 0) / v.length).toFixed(1), total: v.reduce((a, b) => a + b, 0) } }
  // ─── ④ la géométrie publiée ─────────────────────────────────────────────
  par.geometry.computeBoundingBox()
  const bb = par.geometry.boundingBox
  const largeurParois = Math.max(bb.max.x - bb.min.x, bb.max.z - bb.min.z)
  const rep = g._crop
  const lat = (() => { const c = par.userData && par.userData.repere; return c ? null : null })()
  // emprise de la découpe en unités de scène : 2·demi (mercator normalisé) →
  // mètres (× 2πR·cos φ) → unités (× R_GLOBE / R_TERRE = 100 / 6 371 000)
  const centre = (() => { const y = 0.5 - rep.cy; const phi = Math.atan(Math.sinh(2 * Math.PI * y)); return phi })()
  const empriseM = 2 * rep.demi * 2 * Math.PI * 6371000 * Math.cos(centre)
  const empriseU = empriseM * (100 / 6371000)
  const calBB = (() => {
    const p = geo.getAttribute('position'); let mn = [Infinity, Infinity], mx = [-Infinity, -Infinity]
    for (let i = 0; i < (nCal || p.count); i++) { const x = p.getX(i), z = p.getZ(i); if (x < mn[0]) mn[0] = x; if (x > mx[0]) mx[0] = x; if (z < mn[1]) mn[1] = z; if (z > mx[1]) mx[1] = z }
    return Math.max(mx[0] - mn[0], mx[1] - mn[1])
  })()
  return {
    ecran: [w, h], idxCal, plein, nCal,
    temoin,
    jupe: { change: agg('jupe', 'change'), clairs: agg('jupe', 'clairs'), rouges: agg('jupe', 'rouges') },
    parois: { change: agg('parois', 'change'), clairs: agg('parois', 'clairs'), rouges: agg('parois', 'rouges') },
    images,
    geometrie: {
      retraitBaseCrop: g._retraitBaseCrop, retraitJupeCrop: g._retraitJupeCrop,
      plancherMoinsBase: (Number.isFinite(g._plancherJupeCrop) && Number.isFinite(g._baseYCrop)) ? g._plancherJupeCrop - g._baseYCrop : null,
      baseYCrop: g._baseYCrop,
      uMerBord: [mu.uMerBord.value.x, mu.uMerBord.value.y],
      uMerBandeHoule: mu.uMerBandeHoule ? mu.uMerBandeHoule.value : null,
      uCropDemi: g.uniforms.uCropDemi.value, uCropCoin: g.uniforms.uCropCoin.value, uCropCoinN: g.uniforms.uCropCoinN.value,
      largeurParoisU: largeurParois, empriseU, empriseM,
      ecartSocleRelief: largeurParois / empriseU - 1,
      // en « unités de bloc » : l emprise du relief vaut 56 par convention
      socleEnU56: 56 * largeurParois / empriseU,
      calotteU: calBB, calotteSurParois: calBB / largeurParois,
      provisoire: par.userData ? par.userData.provisoire : null,
    },
    altitudeM: e.altitudeCadrageM(),
    png,
  }
})()`

etape(`chargement ${ADRESSE || '(adresse nue)'}`)
await neuf()
etape(`flyTo ${LIEU} z${ZOOM}`)
await aller(LIEU, ZOOM)
await incliner(ELEV, AZIM)
await porter(ALT)
await incliner(ELEV, AZIM)
const stable = await stabiliser()
etape(`stable ${stable}`)
await wait(30)
const r = await page.evaluate(MESURE)
if (r.refus) { etape(`REFUS ${r.refus}`); await nav.close(); process.exit(2) }
const { png, ...reste } = r
fs.writeFileSync(path.join(ICI, `${ETIQ}.json`), JSON.stringify({ etiquette: ETIQ, adresse: ADRESSE, lieu: LIEU, zoom: ZOOM, alt: ALT, elev: ELEV, azim: AZIM, date: new Date().toISOString(), ...reste }, null, 1))
if (png) fs.writeFileSync(path.join(ICI, `${ETIQ}.png`), Buffer.from(png.split(',')[1], 'base64'))
await page.screenshot({ path: path.join(ICI, `${ETIQ}-ecran.png`) })
etape(`témoin ${JSON.stringify(r.temoin)}`)
etape(`jupe   change ${JSON.stringify(r.jupe.change)} clairs ${JSON.stringify(r.jupe.clairs)}`)
etape(`parois change ${JSON.stringify(r.parois.change)} clairs ${JSON.stringify(r.parois.clairs)} rouges ${JSON.stringify(r.parois.rouges)}`)
etape(`géométrie ${JSON.stringify(r.geometrie)}`)
await nav.close()
