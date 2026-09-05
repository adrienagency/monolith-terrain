// SONDE SOC — LE SOCLE : traits sur les parois, emprise plaque/maillage, durée du
// désaccord au changement de palier.
//
//   node scripts/sonde-soc.mjs --port 9651 --etiq avant [--lieu provence] [--z 11]
//
// Trois relevés, dans UNE page :
//   ① au repos à z, capture, puis A/B « jupes cachées » (setDrawRange sur les
//      tuiles) : les pixels qui changent sur l'image sont ceux que les jupes
//      dessinent — les traits blancs, s'ils viennent d'elles.
//   ② à chaque image (hook sur `globe.update`) : `_crop.demi` contre le repère
//      avec lequel `_parois` a été bâti, en mercator et en mètres.
//   ③ un cran de zoom (`modes.cranZoom(1)`) jusqu'au changement de palier, et le
//      nombre d'images pendant lesquelles ② diffère.
import fs from 'node:fs'
import path from 'node:path'
import { fileURLToPath } from 'node:url'

const RACINE = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..')
const A = process.argv.slice(2)
const opt = (n, d = null) => { const i = A.indexOf(n); return i >= 0 && A[i + 1] !== undefined ? A[i + 1] : d }
const PORT = Number(opt('--port', '9651'))
const ETIQ = opt('--etiq', 'avant')
const LIEU = opt('--lieu', 'provence')
const Z = Number(opt('--z', '11'))
const CRANS = Number(opt('--crans', '3'))
// `--provisoire 0` : le levier de banc qui rejoue le dépôt d'avant SOC (le refus
// sans plaque provisoire) — l'A/B dans la même page, règle D13.
const PROVISOIRE = opt('--provisoire', '1') !== '0'
// `--latence 600` : une latence réseau émulée (ms, CDP), pour rejouer le réseau
// d'Adrien — c'est l'aller réseau de la réservation qui fait attendre la plaque.
const LATENCE = Number(opt('--latence', '0'))
const DEBIT = Number(opt('--debit', '0')) // octets/s, 0 = illimité
const SORTIE = opt('--sortie', path.join(RACINE, '.banc', 'SOC', ETIQ))
const LARGEUR = 1280, HAUTEUR = 720
const dodo = (ms) => new Promise((r) => setTimeout(r, ms))
// Provence : le lieu de la vidéo d'Adrien (44,2149 / 5,797, Gap – Laragne)
const LIEUX = { provence: [44.2149, 5.797], majorque: [39.62, 2.98], alpes: [45.92, 6.87], bretagne: [48.38, -4.49] }

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
    'C:/Dev/wt-f3/node_modules/puppeteer-core/lib/puppeteer/puppeteer-core.js',
  ]) if (fs.existsSync(p)) return (await import('file:///' + p.split('\\').join('/'))).default
  console.error('puppeteer-core introuvable'); process.exit(2)
}

// ── L'INSTRUMENT, DANS LA PAGE ─────────────────────────────────────────────────
const INSTRUMENTER = () => {
  const e = window.__exp
  const g = e.globe
  const S = (window.__soc = { journal: [], poses: [], parois: [] })
  const EARTH = 6371008.8
  const R = g.radius
  // la largeur au sol d'un demi-côté mercator : 2π·R_terre·cos(lat)·demi
  S.demiEnM = (demi, lat) => demi * 2 * Math.PI * EARTH * Math.cos((lat * Math.PI) / 180)
  // ① le repère avec lequel les parois ont été bâties — étiqueté sur le mesh
  const orig = g.construireParoisCrop.bind(g)
  g.construireParoisCrop = function (arg) {
    const t0 = performance.now()
    const r = orig(arg)
    const ms = performance.now() - t0
    if (r && r.mesh) {
      r.mesh.userData.repere = { ...this._crop }
      r.mesh.userData.frame = this.frame
      r.mesh.userData.provisoire = !!r.provisoire
    }
    let avecHauteurs = 0
    for (const t of this.tiles.values()) if (t.heights) avecHauteurs++
    S.parois.push({ frame: this.frame, ms: +ms.toFixed(2), refus: r ? r.refus : 'null', couverture: r ? +(r.couverture ?? 0).toFixed(3) : null, provisoire: !!(r && r.provisoire), crop: this._crop ? { ...this._crop } : null, garde: this.gardeHauteurs?.size ?? null, avecHauteurs, file: this.queue?.length ?? null, vol: this.inFlight ?? null })
    return r
  }
  const origPose = g.poserCrop.bind(g)
  g.poserCrop = function (arg) {
    const r = origPose(arg)
    S.poses.push({ frame: this.frame, demi: r.demi, cx: r.cx, cy: r.cy, zoom: r.zoom })
    return r
  }
  // ② la lecture par image, DANS update (avant que l'état ne soit écrasé)
  const origUpdate = g.update.bind(g)
  S.actif = false
  g.update = function (...a) {
    const r = origUpdate(...a)
    if (!S.actif) return r
    const crop = this._crop
    const p = this._parois
    const rep = p?.userData?.repere || null
    const lat = crop ? (Math.atan(Math.sinh(Math.PI * (1 - 2 * crop.cy))) * 180) / Math.PI : 0
    // la boîte des parois, en unités de scène (repère local, x = est, z = sud)
    let boite = null
    if (p) {
      const bb = p.geometry.boundingBox || (p.geometry.computeBoundingBox(), p.geometry.boundingBox)
      boite = { largeur: +(Math.max(bb.max.x - bb.min.x, bb.max.z - bb.min.z) * (EARTH / R)).toFixed(0) }
    }
    // les tuiles dessinées dans le crop, et leur emprise (union des boîtes)
    let dessinees = 0, uMin = Infinity, uMax = -Infinity, vMin = Infinity, vMax = -Infinity
    if (crop) {
      for (const t of this.tiles.values()) {
        if (!t.mesh || !t.mesh.visible) continue
        const n = 2 ** t.z
        let x0 = t.x / n - crop.cx; x0 -= Math.round(x0)
        const x1 = x0 + 1 / n
        const y0 = t.y / n - crop.cy, y1 = y0 + 1 / n
        // recoupe-t-elle le crop ?
        if (x1 <= -crop.demi || x0 >= crop.demi || y1 <= -crop.demi || y0 >= crop.demi) continue
        dessinees++
        uMin = Math.min(uMin, Math.max(x0, -crop.demi)); uMax = Math.max(uMax, Math.min(x1, crop.demi))
        vMin = Math.min(vMin, Math.max(y0, -crop.demi)); vMax = Math.max(vMax, Math.min(y1, crop.demi))
      }
    }
    const u = this.uniforms
    S.journal.push({
      frame: this.frame,
      t: +performance.now().toFixed(0),
      demZoom: e.params.demZoom,
      cropDemi: crop ? crop.demi : null,
      cropZoom: crop ? crop.zoom : null,
      cropM: crop ? +S.demiEnM(crop.demi * 2, lat).toFixed(0) : null,
      uCropDemi: u.uCropDemi.value,
      paroisDemi: rep ? rep.demi : null,
      paroisM: rep ? +S.demiEnM(rep.demi * 2, lat).toFixed(0) : null,
      paroisFrame: p?.userData?.frame ?? null,
      paroisProvisoire: p?.userData?.provisoire ?? null,
      paroisVisible: p ? p.visible : null,
      boiteM: boite ? boite.largeur : null,
      maillageM: dessinees ? +S.demiEnM(Math.max(uMax - uMin, vMax - vMin), lat).toFixed(0) : 0,
      dessineesDansCrop: dessinees,
      zServi: this._zCropServi,
      zCible: this._zCropCible,
      estompage: u.uEstompage.value,
      cropSeul: !!this._cropSeul,
      busy: !!e.modes.busy,
      alt: Math.round(e.altitudeCadrageM()),
      lateral: Globe_effacement(this),
    })
    return r
  }
  function Globe_effacement(gl) { try { return Object.getPrototypeOf(gl)._effacementLateralActif.call(gl) } catch { return null } }
  // A/B des jupes : cacher les 6 indices par arête de bord, en fin de tampon
  S.jupes = (visible) => {
    let n = 0
    for (const t of g.tiles.values()) {
      const geo = t.mesh?.geometry
      const d = geo?.userData?.jupe
      if (!d || !geo.index) continue
      const total = geo.index.count
      const sansJupe = total - d.bord.length * 6
      geo.setDrawRange(0, visible ? Infinity : sansJupe)
      n++
    }
    return n
  }
  return 'posé'
}

async function attendreCalme(page, maxMs = 40000) {
  const a = Date.now(); let precedent = null; let stableDepuis = null
  while (Date.now() - a < maxMs) {
    const e = await page.evaluate(() => { const g = window.__exp.globe; let ready = 0; for (const t of g.tiles.values()) if (t.state === 'ready') ready++; return { ready, file: g.queue.length, vol: g.inFlight, busy: !!window.__exp.modes.busy } })
    const cle = `${e.ready}/${e.file}/${e.vol}/${e.busy}`
    if (e.file === 0 && e.vol === 0 && !e.busy && cle === precedent) { if (stableDepuis === null) stableDepuis = Date.now(); else if (Date.now() - stableDepuis > 1500) return { ms: Date.now() - a, expire: false } } else stableDepuis = null
    precedent = cle
    await dodo(150)
  }
  return { ms: Date.now() - a, expire: true }
}

async function lancer() {
  fs.mkdirSync(SORTIE, { recursive: true })
  const puppeteer = await chargerPuppeteer()
  const nav = await puppeteer.launch({
    executablePath: trouverChrome(), headless: 'new',
    args: [`--window-size=${LARGEUR},${HAUTEUR + 120}`, '--use-angle=default', '--no-sandbox'],
    defaultViewport: { width: LARGEUR, height: HAUTEUR, deviceScaleFactor: 1 },
  })
  const page = (await nav.pages())[0] || (await nav.newPage())
  const erreurs = []
  page.on('pageerror', (er) => erreurs.push('pageerror: ' + String(er.message).slice(0, 300)))
  page.on('console', (m) => { if (m.type() === 'error') erreurs.push(m.text().slice(0, 300)) })
  await page.evaluateOnNewDocument(() => { try { localStorage.setItem('shibumap-workmode', 'studio') } catch {} })
  await page.goto(`http://127.0.0.1:${PORT}/`, { waitUntil: 'domcontentloaded', timeout: 60000 })
  await page.waitForFunction('!!(window.__exp && window.__exp.globe)', { timeout: 120000 })
  const journal = { etiquette: ETIQ, port: PORT, lieu: LIEU, z: Z, date: new Date().toISOString() }
  journal.instrument = await page.evaluate(INSTRUMENTER)
  await page.waitForFunction("!!document.getElementById('loading')?.classList.contains('hidden')", { timeout: 240000 })
  await page.keyboard.press('Escape'); await dodo(500)
  await page.evaluate(() => { document.body.classList.remove('ce-hub'); document.querySelector('.ce-hubveil')?.remove(); document.querySelectorAll('.ce-elemwrap').forEach((n) => n.remove()) })
  await page.waitForFunction('!(window.__exp.modes && (window.__exp.modes.busy || window.__exp.modes.travel))', { timeout: 60000, polling: 200 }).catch(() => {})
  await dodo(1500)

  const [lat, lon] = LIEUX[LIEU] || LIEUX.provence
  // ⚠️ LE GRAIN EST ÉTEINT POUR LA MESURE : deux captures identiques diffèrent de
  // 115 000 px avec lui (le témoin bouge seul — piège commun). `params.grain`
  // est relu à la naissance du crop (`poserRegimeCrop`), donc avant le vol.
  await page.evaluate((prov) => { window.__exp.params.grain = 0; window.__soc.actif = true; if (!prov) window.__exp.globe.plaqueProvisoire = false }, PROVISOIRE)
  journal.provisoire = PROVISOIRE
  journal.latenceMs = LATENCE
  if (LATENCE > 0 || DEBIT > 0) {
    const cdp = await page.target().createCDPSession()
    await cdp.send('Network.enable')
    await cdp.send('Network.emulateNetworkConditions', { offline: false, latency: LATENCE, downloadThroughput: DEBIT > 0 ? DEBIT : -1, uploadThroughput: -1 })
  }
  await page.evaluate((a, b, z) => window.__exp.modes.flyTo(a, b, z), lat, lon, Z).catch((er) => { journal.flyToErreur = String(er) })
  await page.waitForFunction('!(window.__exp.modes.busy || window.__exp.modes.travel)', { timeout: 90000, polling: 200 }).catch(() => { journal.busyApresVol = true })
  const lire = async () => page.evaluate(() => window.__soc.journal[window.__soc.journal.length - 1])
  // LA POSE DE LA VIDÉO : le bloc entier dans le cadre, vue de trois quarts
  // (m_030 / m_060 d'Adrien). L'altitude de cadrage est prise à ~1,1 largeur de
  // crop ; l'inclinaison à 35°, le cap à 15°.
  const cropM0 = (await lire()).cropM
  const ALT = Number(opt('--alt', String(Math.round(cropM0 * 1.1))))
  journal.altVue = ALT
  await page.evaluate(async (a, elevDeg, azDeg) => {
    const e = window.__exp, cam = e.camera, ct = e.controls
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
    const d = cam.position.distanceTo(ct.target)
    const p = (elevDeg * Math.PI) / 180, az = (azDeg * Math.PI) / 180
    cam.position.set(ct.target.x + d * Math.cos(p) * Math.sin(az), ct.target.y + d * Math.sin(p), ct.target.z + d * Math.cos(p) * Math.cos(az))
    cam.lookAt(ct.target)
    ct.update?.()
  }, ALT, Number(opt('--elev', '35')), Number(opt('--az', '15')))
  await dodo(200)
  // L'ARRIVÉE — c'est là que la plaque manque (« avant ») ; la vue est posée d'abord, pour que la capture montre le bloc : captures dès que le
  // crop est posé, à +0, +300, +1 000, +2 500 ms, avec l'état lu dans `update`.
  await page.waitForFunction('!!(window.__exp.globe._crop)', { timeout: 30000, polling: 20 }).catch(() => {})
  const tA = Date.now()
  journal.arrivee = []
  for (const ms of [0, 300, 1000, 2500]) {
    const reste = tA + ms - Date.now()
    if (reste > 0) await dodo(reste)
    const e = await page.evaluate(() => window.__soc.journal[window.__soc.journal.length - 1])
    await page.screenshot({ path: path.join(SORTIE, `00-arrivee-${String(ms).padStart(4, '0')}ms.png`) })
    journal.arrivee.push({ ms, crop: e?.cropM ?? null, parois: e?.paroisM ?? null, provisoire: e?.paroisProvisoire ?? null })
    console.log(`   arrivée +${ms} ms → crop ${e?.cropM} m · parois ${e?.paroisM} m · provisoire ${e?.paroisProvisoire}`)
  }
  journal.calmeArrivee = await attendreCalme(page, 45000)
  await dodo(1500)
  journal.calmeVue = await attendreCalme(page, 45000)
  await dodo(1000)
  journal.repos = await lire()
  console.log(`${ETIQ} · repos z${Z} : ${JSON.stringify(journal.repos)}`)
  await page.screenshot({ path: path.join(SORTIE, `01-repos-z${Z}.png`) })
  // ① A/B jupes cachées, à la même seconde
  journal.jupesCachees = await page.evaluate(() => window.__soc.jupes(false))
  await dodo(400)
  await page.screenshot({ path: path.join(SORTIE, `02-repos-z${Z}-sans-jupes.png`) })
  await page.evaluate(() => window.__soc.jupes(true))
  await dodo(400)
  await page.screenshot({ path: path.join(SORTIE, `03-repos-z${Z}-temoin.png`) })
  // ① bis : le domaine de l'effacement latéral forcé (levier de banc de CULL)
  journal.lateralAvant = await page.evaluate(() => Object.getPrototypeOf(window.__exp.globe)._effacementLateralActif.call(window.__exp.globe))
  await page.evaluate(() => { const g = window.__exp.globe; g.jupeDomaine = false; g._retaillerJupes() })
  await dodo(400)
  await page.screenshot({ path: path.join(SORTIE, `04-repos-z${Z}-domaine-force.png`) })
  await page.evaluate(() => { const g = window.__exp.globe; delete g.jupeDomaine; g._retaillerJupes() })
  await dodo(400)

  // ③ le changement de palier : des crans de zoom avant jusqu'à ce que demZoom bouge
  const demZoom0 = journal.repos.demZoom
  const depart = await page.evaluate(() => window.__soc.journal.length)
  journal.crans = []
  for (let i = 0; i < CRANS; i++) {
    await page.evaluate(() => window.__exp.modes.cranZoom(1))
    await dodo(250)
    const e = await lire()
    journal.crans.push({ i, demZoom: e.demZoom, alt: e.alt, busy: e.busy })
    if (e.demZoom !== demZoom0) break
  }
  const t0 = Date.now()
  for (const ms of [0, 250, 600, 1500, 3000, 6000]) {
    const reste = t0 + ms - Date.now()
    if (reste > 0) await dodo(reste)
    const e = await lire()
    await page.screenshot({ path: path.join(SORTIE, `05-palier-${String(ms).padStart(4, '0')}ms.png`) })
    console.log(`   +${ms} ms → demZoom ${e.demZoom} · crop ${e.cropM} m · parois ${e.paroisM} m · maillage ${e.maillageM} m · zServi ${e.zServi}`)
  }
  journal.calmePalier = await attendreCalme(page, 45000)
  await dodo(1000)
  journal.reposPalier = await lire()
  await page.screenshot({ path: path.join(SORTIE, `06-palier-repos.png`) })
  // les images du désaccord
  const J = await page.evaluate(() => window.__soc.journal)
  const P = await page.evaluate(() => window.__soc.parois)
  const poses = await page.evaluate(() => window.__soc.poses)
  const apres = J.slice(depart)
  const desaccord = apres.filter((r) => r.paroisDemi != null && r.cropDemi != null && Math.abs(r.paroisDemi - r.cropDemi) > 1e-12)
  const terrePlusPetite = apres.filter((r) => r.paroisDemi != null && r.cropDemi != null && r.paroisDemi > r.cropDemi * (1 + 1e-9))
  journal.desaccord = {
    imagesApresCran: apres.length,
    imagesDesaccord: desaccord.length,
    imagesTerrePlusPetite: terrePlusPetite.length,
    ms: desaccord.length ? desaccord[desaccord.length - 1].t - desaccord[0].t : 0,
    premiere: desaccord[0] || null,
    derniere: desaccord[desaccord.length - 1] || null,
    ecartMaxM: Math.max(0, ...apres.map((r) => (r.paroisM != null && r.cropM != null ? Math.abs(r.paroisM - r.cropM) : 0))),
  }
  journal.parois = P
  journal.poses = poses
  journal.erreurs = erreurs
  fs.writeFileSync(path.join(SORTIE, 'journal.json'), JSON.stringify(journal, null, 1))
  fs.writeFileSync(path.join(SORTIE, 'images.json'), JSON.stringify(J))
  console.log(`${ETIQ} · désaccord : ${JSON.stringify(journal.desaccord)}`)
  console.log(`${ETIQ} · parois : ${JSON.stringify(P)}`)
  console.log(`${ETIQ} · poses : ${JSON.stringify(poses)}`)
  if (erreurs.length) console.log('erreurs :', erreurs.slice(0, 5))
  await nav.close()
}
lancer().catch((e) => { console.error(e); process.exit(1) })
