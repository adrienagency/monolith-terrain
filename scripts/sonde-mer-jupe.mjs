// SONDE MER JUPE — LA NAPPE SORT-ELLE DE L'ARÊTE DU SOCLE QUAND LA HOULE BOUGE ?
//
// ⚡ **CE N'EST PAS LA MESURE DE `sonde-mer-crop.mjs`, ET C'EST TOUT LE POINT.**
// Celle-là comparait `uMerBord` VIVANT à `uMerBord` IDÉAL : depuis que
// `bordDeMer()` rend toujours l'emprise du socle, les deux sont égaux et son
// A/B rend **0 par construction, houle comprise**. Elle ne peut donc pas voir le
// défaut D24 — les crêtes que le déplacement LATÉRAL pousse au-delà de l'arête,
// parce que le `discard` du fragment mesure `vCrop`, la coordonnée **AU REPOS**,
// pendant que le sommet, lui, a bougé.
//
// ⚠️ **LA MESURE EST GÉOMÉTRIQUE, PAS UNE COMPARAISON DE DEUX RÉGLAGES.**
//   ① l'ARÊTE : le contour du crop (`|u| = 1` ou `|v| = 1` dans `aCrop`) est
//      RELU dans le tampon d'attributs de la nappe — donc AU REPOS —, transformé
//      par `matrixWorld` et projeté à l'écran. C'est un polygone fermé.
//   ② la NAPPE : sa silhouette exacte, par A/B `mer.visible` au GPU, la calotte
//      SEULE (`setDrawRange`) — la jupe pend sous l'arête par construction et
//      compterait comme un débordement qu'elle n'est pas.
//   ③ le CHIFFRE : les pixels de ① hors de ②, sur **20 images consécutives**
//      dont on fait varier `uMerTemps` : la houle bouge, une image ne prouve rien.
//
// ⛔ **PAS DE LIEN PROFOND** (`#s=`) : rapport MER §8 — le champ de la mer y est
// cuit VIDE (`profMaxUnites = 1e-6`), la nappe rend 0 pixel, et tout « 0 hors
// arête » y serait une tautologie. La sonde REFUSE un poste sans mer à l'écran.
//
// ⛔ **PAS DE `gotoCtl.go`** : il passe par `modes.flyTo`, qui rend des NaN
// (PF3 §7.4). On se déplace en TRANSLATANT la cible, comme le scénario
// « déménagement » de `sonde-mer-crop.mjs`.
//
// EMPLOI
//   npm run dev -- --host 127.0.0.1 --port 8341
//   node scripts/sonde-mer-jupe.mjs --port 8341 --etiquette AVANT --repete 3
//
// Sortie : `.banc/MER2/<etiquette>.json`, captures dans `--captures`.
import fs from 'node:fs'
import path from 'node:path'
import { fileURLToPath } from 'node:url'

const RACINE = path.dirname(path.dirname(fileURLToPath(import.meta.url)))
const ICI = path.join(RACINE, '.banc', 'MER2')
fs.mkdirSync(ICI, { recursive: true })
const A = process.argv.slice(2)
const opt = (n, d) => { const i = A.indexOf(n); return i >= 0 && A[i + 1] !== undefined ? A[i + 1] : d }
const PORT = Number(opt('--port', '8341'))
const ETIQ = opt('--etiquette', 'mer2')
const N = Number(opt('--repete', '3'))
const ALTS = opt('--alts', '28000,12000,5000').split(',').map(Number)
const IMAGES = Number(opt('--images', '20'))
const CAPTURES = opt('--captures', '')
const DEMENAGE = opt('--demenage', '0,20,-20').split(',').map(Number)
// ⚠️ **LE CADRAGE D'ADRIEN EST OBLIQUE, ET UNE VUE DU DESSUS NE PROUVE RIEN.**
// À 12 km, vu du zénith, l'arête du socle sort du champ : le polygone couvre
// l'écran ENTIER (1 024 000 px relevés) et le test « hors arête » devient
// tautologique. On incline donc la vue pour que les quatre arêtes soient dans
// le cadre — c'est le cadrage de sa capture, l'angle du socle.
const ELEV = Number(opt('--elevation', '34'))
const AZIM = Number(opt('--azimut', '45'))
const COUT = opt('--cout', '1') !== '0'
// BIS : une chaîne de requête collée à l'adresse (`?biseau=1` rallume le biseau)
const ADRESSE = opt('--adresse', '')
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

async function pageNeuve() {
  try { await page.close() } catch {}
  page = await nav.newPage()
}

async function neuf() {
  // ⛔ AUCUN HASH : voir l'en-tête.
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

const wait = (n) => page.evaluate((k) => new Promise((r) => { let i = 0; const t = () => (++i >= k ? r() : requestAnimationFrame(t)); requestAnimationFrame(t) }), n)

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
  await stabiliser()
}

// pose la DIRECTION de vue (elevation / azimut), sans toucher a la distance
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

async function demenager(dx) {
  if (!dx) return
  await page.evaluate((d) => {
    const e = window.__exp, ct = e.controls, cam = e.camera
    const v = cam.position.clone().sub(ct.target)
    ct.target.x += d
    cam.position.copy(ct.target).add(v)
    ct.update?.()
  }, dx)
  await wait(6)
  await dodo(3000)
  await stabiliser()
}

// ⚠️ La chaîne du crop doit être POSÉE : un relevé pris pendant une repose de la
// mer rend la silhouette entière comme « débordement » (rapport MER §7.6).
async function stabiliser(essais = 30) {
  const signature = () => page.evaluate(() => {
    const g = window.__exp.globe
    return JSON.stringify({
      mer: !!g._mer,
      compte: g._merEtat?.compte ?? null,
      couverture: g._merEtat?.couverture ?? null,
      tuiles: g.tiles?.size ?? null,
      busy: !!window.__exp.modes.busy,
    })
  })
  let prec = null, stables = 0
  for (let i = 0; i < essais; i++) {
    // une page qui se recharge fait disparaitre __exp : on attend, on ne casse pas
    const s = await signature().catch(() => null)
    if (s === null) { await dodo(1500); stables = 0; continue }
    if (s === prec) { if (++stables >= 2) return true } else { stables = 0 }
    prec = s
    await dodo(700)
  }
  return false
}

// ══════════ LA MESURE, ENTIÈREMENT DANS LA PAGE ═══════════════════════════════
//
// (Une seule `evaluate` : les 40 lectures de tampon ne traversent jamais le
// pont — 4 Mo chacune.)
const MESURE = `((nImages, avecCout) => {
  const e = window.__exp, gl = e.renderer.getContext()
  const g = e.globe, mer = g._mer
  if (!mer) return { mer: false }
  const geo = mer.geometry, mu = mer.material.uniforms
  const aCrop = geo.getAttribute('aCrop'), pos = geo.getAttribute('position')
  const et = g._merEtat || {}
  const nCal = (et.compte?.sommets) || pos.count
  const idxCal = (et.compte?.triangles || 0) * 3
  const nTotal = geo.index ? geo.index.count : 0

  // ─── ① L'ARÊTE, RELUE DANS LE TAMPON (donc AU REPOS) ────────────────────────
  // Le contour du crop est |u| = 1 ou |v| = 1 dans aCrop. Sur la grille de la
  // calotte (rangée-major, u variant le plus vite), ce sont quatre lignes
  // d'indices : on les parcourt dans l'ordre pour fermer le polygone.
  const n = et.compte?.pas
  const E = (et.compte?.emprise !== undefined ? et.compte.emprise : et.compte?.portee)
  if (!(n > 1) || !(E > 0)) return { mer: true, refus: 'grille inconnue' }
  const i0 = Math.round((n * (1 - 1 / E)) / 2)
  const i1 = Math.round((n * (1 + 1 / E)) / 2)
  const idx = (i, j) => j * (n + 1) + i
  const ring = []
  for (let i = i0; i < i1; i++) ring.push(idx(i, i0))
  for (let j = i0; j < i1; j++) ring.push(idx(i1, j))
  for (let i = i1; i > i0; i--) ring.push(idx(i, i1))
  for (let j = i1; j > i0; j--) ring.push(idx(i0, j))
  // contrôle : tous les sommets de l'anneau sont bien SUR |u| = 1 ou |v| = 1
  let ecartAnneau = 0
  for (const k of ring) {
    const u = aCrop.getX(k), v = aCrop.getY(k)
    ecartAnneau = Math.max(ecartAnneau, Math.abs(Math.max(Math.abs(u), Math.abs(v)) - 1))
  }

  // La nappe vit dans sceneGlobe, rendue par camGlobe (passe de fond, main.js
  // 4981). Projeter avec e.camera place l arete a -846 px hors de l ecran : c est
  // la confusion d espace bloc/globe, payee ici aussi.
  const cam = e.camGlobe || e.camera
  cam.updateMatrixWorld(); mer.updateMatrixWorld()
  const mw = mer.matrixWorld.elements
  const vp = cam.projectionMatrix.clone().multiply(cam.matrixWorldInverse).elements
  const w = gl.drawingBufferWidth, h = gl.drawingBufferHeight
  const poly = []
  let derriere = 0
  for (const k of ring) {
    const x = pos.getX(k), y = pos.getY(k), z = pos.getZ(k)
    const X = mw[0]*x + mw[4]*y + mw[8]*z + mw[12]
    const Y = mw[1]*x + mw[5]*y + mw[9]*z + mw[13]
    const Z = mw[2]*x + mw[6]*y + mw[10]*z + mw[14]
    const cx = vp[0]*X + vp[4]*Y + vp[8]*Z + vp[12]
    const cy = vp[1]*X + vp[5]*Y + vp[9]*Z + vp[13]
    const cw = vp[3]*X + vp[7]*Y + vp[11]*Z + vp[15]
    if (!(cw > 1e-9)) { derriere++; continue }
    // repère de readPixels : origine EN BAS À GAUCHE
    poly.push([(cx / cw * 0.5 + 0.5) * w, (cy / cw * 0.5 + 0.5) * h])
  }
  if (poly.length < 8) return { mer: true, refus: 'arête non projetable', derriere }

  // masque « dedans l'arête », par balayage de lignes (exact, pas d'anti-aliasing)
  const dedans = new Uint8Array(w * h)
  {
    const noeuds = []
    for (let py = 0; py < h; py++) {
      noeuds.length = 0
      const yc = py + 0.5
      for (let i = 0, j = poly.length - 1; i < poly.length; j = i++) {
        const [xi, yi] = poly[i], [xj, yj] = poly[j]
        if ((yi > yc) !== (yj > yc)) noeuds.push(xi + ((yc - yi) / (yj - yi)) * (xj - xi))
      }
      noeuds.sort((a, b) => a - b)
      for (let k = 0; k + 1 < noeuds.length; k += 2) {
        const a = Math.max(0, Math.ceil(noeuds[k] - 0.5)), b = Math.min(w - 1, Math.floor(noeuds[k + 1] - 0.5))
        for (let px = a; px <= b; px++) dedans[py * w + px] = 1
      }
    }
  }
  let airePoly = 0
  for (let k = 0; k < dedans.length; k++) airePoly += dedans[k]

  // ─── ② LA SILHOUETTE DE LA NAPPE, LA CALOTTE SEULE ──────────────────────────
  const cap = () => {
    for (const p of e.composer.passes) if (p.fullscreenMaterial && 'time' in p.fullscreenMaterial) p.fullscreenMaterial.time = 0
    e.composer.render(0)
    const a = new Uint8Array(w * h * 4)
    gl.readPixels(0, 0, w, h, gl.RGBA, gl.UNSIGNED_BYTE, a)
    return a
  }
  const diff = (a, b) => {
    let n = 0, m = 0, s = 0
    for (let i = 0; i < a.length; i += 4) {
      const d = Math.max(Math.abs(a[i] - b[i]), Math.abs(a[i + 1] - b[i + 1]), Math.abs(a[i + 2] - b[i + 2]))
      if (d > 4) n++
      if (d > m) m = d
      s += d
    }
    return { n, max: m, moyen: +(s / (a.length / 4)).toFixed(4) }
  }
  const t0 = mu.uMerTemps.value
  const chop0 = mu.uMerChop.value
  let png = null
  // LE TEMOIN EST uMerChop = 0, ET IL EST INDISPENSABLE. Le polygone de
  // l anneau est une LIGNE BRISÉE la ou l arete est un arc : ses cordes passent
  // legerement EN DEDANS, donc quelques pixels peuvent compter « hors arete »
  // sans que rien ne deborde. Or chop ne pilote QUE le terme lateral de
  // Gerstner (q), pas la hauteur : chop = 0 laisse la houle monter et descendre
  // et supprime le deplacement LATERAL, c est-a-dire exactement ce qu Adrien
  // accuse. Le temoin donne donc le plancher de la mesure.
  const serie = (temoin) => {
    mu.uMerChop.value = temoin ? 0 : chop0
    const images = []
    let horsMax = 0, horsTotal = 0, silhouetteMin = Infinity
    for (let f = 0; f < nImages; f++) {
      mu.uMerTemps.value = t0 + f * 0.137 // la houle AVANCE : une phase ne prouve rien
      if (idxCal > 0) geo.setDrawRange(0, idxCal)
      const A = cap()
      if (f === 0 && !temoin) png = e.renderer.domElement.toDataURL('image/png')
      mer.visible = false
      const B = cap()
      mer.visible = true
      let sil = 0, hors = 0
      for (let py = 0; py < h; py++) {
        for (let px = 0; px < w; px++) {
          const p = py * w + px, q = p * 4
          const d = Math.max(Math.abs(A[q] - B[q]), Math.abs(A[q + 1] - B[q + 1]), Math.abs(A[q + 2] - B[q + 2]))
          if (d <= 4) continue
          sil++
          if (!dedans[p]) hors++
        }
      }
      images.push({ f, silhouette: sil, hors })
      horsTotal += hors
      if (hors > horsMax) horsMax = hors
      if (sil < silhouetteMin) silhouetteMin = sil
    }
    return { images, horsMax, horsTotal, silhouetteMin }
  }
  const vivant = serie(false)
  const temoin = serie(true)
  const { images, horsMax, horsTotal, silhouetteMin } = vivant
  mu.uMerTemps.value = t0
  mu.uMerChop.value = chop0
  geo.setDrawRange(0, nTotal)

  // ─── LA BANDE SE VOIT-ELLE ? A/B DANS LA MEME SESSION, TEMOIN NUL ──────────
  //
  // C est LA question de la moitie ③ du critere (la mer au large inchangee), et
  // elle ne se repond pas en comparant deux campagnes : la houle a change de
  // phase entre elles. Ici A = la bande vivante, B = uMerBandeHoule mis a ZERO,
  // c est-a-dire la mer SANS extinction de bord, dans la meme image. La part de
  // la nappe que la bande deplace se lit directement.
  let bandeAB = null
  if (mu.uMerBandeHoule) {
    const b0 = mu.uMerBandeHoule.value
    const A0 = cap()
    const temoinNul = diff(A0, cap())
    mu.uMerBandeHoule.value = 0
    const sansBande = diff(A0, cap())
    mu.uMerBandeHoule.value = b0
    const retour = diff(A0, cap())
    mer.visible = false
    const silhouette = diff(A0, cap())
    mer.visible = true
    bandeAB = {
      bande: b0, temoinNul, sansBande, retour, silhouette,
      partPourCent: silhouette.n ? +(100 * sansBande.n / silhouette.n).toFixed(2) : null,
    }
  }

  // ─── ③ LE COÛT : le temps de la passe mer, A/B nappe visible / cachée ───────
  let cout = null
  if (avecCout) {
    const chrono = (visible, k) => {
      mer.visible = visible
      for (let i = 0; i < 5; i++) e.composer.render(0)
      gl.finish()
      const d = performance.now()
      for (let i = 0; i < k; i++) e.composer.render(0)
      gl.finish()
      return (performance.now() - d) / k
    }
    const avec = [], sans = []
    for (let r = 0; r < 9; r++) { avec.push(chrono(true, 120)); sans.push(chrono(false, 120)) }
    mer.visible = true
    const med = (a) => a.slice().sort((x, y) => x - y)[a.length >> 1]
    cout = { avecMs: +med(avec).toFixed(4), sansMs: +med(sans).toFixed(4), merMs: +(med(avec) - med(sans)).toFixed(4), avec, sans }
  }

  // ─── LES SOMMETS QUI ATTEIGNENT LE DÉPLACEMENT ──────────────────────────────
  // Le prédicat est celui du nuanceur : la superellipse de la découpe sur aCrop.
  const coin = g.uniforms.uCropCoin.value, N4 = g.uniforms.uCropCoinN.value
  const finBord = mu.uMerBord.value.y
  const bande = mu.uMerBandeHoule ? mu.uMerBandeHoule.value : 0
  const dBord = (u, v) => {
    const qx = Math.abs(u) - (1 - coin), qy = Math.abs(v) - (1 - coin)
    const cx = Math.max(qx, 0), cy = Math.max(qy, 0)
    const pn = Math.pow(Math.pow(cx, N4) + Math.pow(cy, N4), 1 / N4)
    return pn - coin + Math.min(Math.max(qx, qy), 0)
  }
  // AVANT le correctif il n y a AUCUN predicat de bord au sommet : les
  // pos.count sommets passent tous par Gerstner (sauf la sortie de richesse).
  // APRES, seuls ceux dont dBord < uMerBord.y y entrent. On compte les deux.
  let sommetsDeplaces = 0
  for (let k = 0; k < nCal; k++) {
    if (dBord(aCrop.getX(k), aCrop.getY(k)) < finBord) sommetsDeplaces++
  }

  return {
    mer: true,
    grille: { pas: n, emprise: E, portee: et.portee, sommets: pos.count, sommetsCalotte: nCal, triangles: (et.compte?.triangles ?? null), jupe: et.jupe ?? null },
    ecartAnneau, derriere, airePoly, ecran: [w, h],
    bord: [mu.uMerBord.value.x, mu.uMerBord.value.y],
    bandeHoule: mu.uMerBandeHoule ? mu.uMerBandeHoule.value : null,
    parDemi: et.parDemi ?? null,
    sommetsDeplaces, sommetsTotal: pos.count,
    profMaxUnites: et.profMaxUnites ?? null, couverture: et.couverture ?? null, bathy: et.bathy ?? null,
    images, horsMax, horsTotal, silhouetteMin, cout, bandeAB,
    temoinChopZero: { horsMax: temoin.horsMax, horsTotal: temoin.horsTotal, silhouetteMin: temoin.silhouetteMin },
    png,
  }
})`

const R = { port: PORT, alts: ALTS, images: IMAGES, viewport: [W, H], date: new Date().toISOString(), postes: [] }
if (CAPTURES) fs.mkdirSync(path.join(RACINE, CAPTURES), { recursive: true })

for (let k = 0; k < N; k++) {
  let ok = false
  for (let essai = 0; essai < 3 && !ok; essai++) {
    try { await neuf(); ok = true }
    catch (err) { etape(`  chargement raté (${err.message.slice(0, 80)})`); await pageNeuve() }
  }
  if (!ok) throw new Error('trois chargements ratés')

  for (const dx of DEMENAGE) {
    // ⚠️ **LA PAGE PEUT SE DÉTACHER EN COURS DE BANC** (rechargement, cadre
    // remplacé) : deux campagnes s y sont arrêtées au 8e poste. On repart d une
    // page neuve plutôt que de perdre les postes restants.
    try { await demenager(dx) } catch { await pageNeuve(); await neuf(); await demenager(dx) }
    for (const alt of ALTS) {
      try {
      await incliner(ELEV, AZIM)
      await porter(alt)
      // ⚠️ **LES ARGUMENTS SONT COLLÉS DANS LA SOURCE, PAS PASSÉS** : quand le
      // premier argument d'`evaluate` est une CHAÎNE, puppeteer l'évalue comme
      // une expression et IGNORE les arguments suivants. Mon premier relevé a
      // rendu un poste vide pour ça — la fonction elle-même était sérialisée.
      const m = await page.evaluate(`${MESURE}(${IMAGES}, ${COUT})`)
      const { png, ...sansPng } = m
      const nom = `p${k}-dx${dx}-alt${alt}`
      R.postes.push({ nom, ...sansPng })
      // ⛔ **ÉCRIT À CHAQUE POSTE, PAS À LA FIN** : la première campagne s est
      // arrêtée sur une page détachée au 8e poste et n a RIEN écrit — dix-sept
      // relevés qui n existaient plus que dans la console.
      fs.writeFileSync(path.join(ICI, `${ETIQ}.json`), JSON.stringify(R, null, 2))
      if (!m.mer || m.refus) { etape(`#${k + 1} ${nom} → ⚠️ ${m.refus || 'AUCUNE MER'} — poste non probant`); continue }
      const vide = m.silhouetteMin === 0
      etape(`#${k + 1} ${nom} · grille ${m.grille.pas}/${m.grille.emprise} · sommets ${m.grille.sommets} · HORS ARÊTE max ${m.horsMax} px, total ${m.horsTotal} px sur ${IMAGES} images · temoin chop0 max ${m.temoinChopZero.horsMax} px · silhouette min ${m.silhouetteMin} px${m.bandeAB ? ` · bande visible sur ${m.bandeAB.partPourCent} % de la nappe (temoin ${m.bandeAB.temoinNul.n}, retour ${m.bandeAB.retour.n})` : ''}${vide ? ' ⚠️ AUCUNE MER À L ÉCRAN — poste non probant' : ''}${m.cout ? ` · mer ${m.cout.merMs} ms/img` : ''}`)
      if (CAPTURES && png) {
        fs.writeFileSync(path.join(RACINE, CAPTURES, `${ETIQ}-${nom}.png`), Buffer.from(String(png).split(',')[1], 'base64'))
      }
      } catch (err) {
        etape(`  poste perdu (${String(err.message).slice(0, 60)}) — page neuve`)
        await pageNeuve()
        try { await neuf() } catch {}
      }
    }
  }
  await pageNeuve()
}

fs.writeFileSync(path.join(ICI, `${ETIQ}.json`), JSON.stringify(R, null, 2))
const probants = R.postes.filter((p) => p.mer && !p.refus && p.silhouetteMin > 0)
console.log(`\n=== ${probants.length} postes probants sur ${R.postes.length}`)
console.log(`=== HORS ARÊTE : max ${Math.max(0, ...probants.map((p) => p.horsMax))} px · total ${probants.reduce((s, p) => s + p.horsTotal, 0)} px`)
console.log(`=== .banc/MER2/${ETIQ}.json`)
await nav.close()
