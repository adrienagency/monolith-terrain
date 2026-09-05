// SONDE TRO — LES TROUS DU QUADTREE MARITIME (Réunion, z11 → crop z13).
//
//   node scripts/sonde-tro.mjs --port 10711 --etiq avant [--z 11] [--crans 6]
//
// Chemin FIXE (piège commun « l'état dépend du chemin ») : `modes.flyTo(lat, lon,
// 11)` sur la Réunion (le cartouche de la vidéo dit « −21.2484, 55.7666 · Z11 »),
// puis `modes.cranZoom(1)` cran par cran jusqu'au crop, puis vers z13.
//
// À chaque palier, DANS `globe.update` (hook) : la COUVERTURE du crop — une grille
// de points en mercator sur l'emprise `_crop`, et pour chacun le nombre de tuiles
// dessinées qui le couvrent (entières, ou quadrant non masqué d'un parent partiel).
// 0 = trou de RENDU. Plus le relevé des tuiles du crop : z, état, hauteur min/max
// du maillage (les hauteurs de `t.heights` sont relâchées ; on lit la géométrie),
// et le plancher du bloc (`_rayonPlancherCrop`).
import fs from 'node:fs'
import path from 'node:path'
import { fileURLToPath } from 'node:url'

const RACINE = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..')
const A = process.argv.slice(2)
const opt = (n, d = null) => { const i = A.indexOf(n); return i >= 0 && A[i + 1] !== undefined ? A[i + 1] : d }
const PORT = Number(opt('--port', '10711'))
const ETIQ = opt('--etiq', 'avant')
const Z = Number(opt('--z', '11'))
const CRANS = Number(opt('--crans', '8'))
const LAT = Number(opt('--lat', '-21.2484'))
const LON = Number(opt('--lon', '55.7666'))
const LATENCE = Number(opt('--latence', '0'))
const SORTIE = opt('--sortie', path.join(RACINE, '.banc', 'TRO', ETIQ))
const LARGEUR = 1280, HAUTEUR = 720
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
    'C:/Dev/wt-f3/node_modules/puppeteer-core/lib/puppeteer/puppeteer-core.js',
  ]) if (fs.existsSync(p)) return (await import('file:///' + p.split('\\').join('/'))).default
  console.error('puppeteer-core introuvable'); process.exit(2)
}

// ── L'INSTRUMENT, DANS LA PAGE ─────────────────────────────────────────────────
const INSTRUMENTER = () => {
  const e = window.__exp
  const g = e.globe
  const S = (window.__tro = { images: [], actif: false })
  const quadrantDe = (k) => (k.x & 1) | ((k.y & 1) << 1) // même convention que globe.js ? vérifié ci-dessous
  // On lit la convention de globe.js à travers `t._partiel` : le bit i du masque
  // vaut « le parent couvre le quadrant i ». On la RELÈVE plutôt que la supposer :
  // `_decouperEnQuadrants` range les groupes par (u<0.5, v<0.5) — cf. lecture.
  S.couverture = (N = 32) => {
    const crop = g._crop
    if (!crop) return null
    const dess = []
    for (const t of g.tiles.values()) {
      if (!t.mesh || !t.mesh.visible) continue
      dess.push(t)
    }
    let trous = 0, doubles = 0, pts = 0
    const trousListe = []
    const parNiveau = {}
    for (let i = 0; i < N; i++) for (let j = 0; j < N; j++) {
      const u = crop.cx - crop.demi + ((i + 0.5) / N) * 2 * crop.demi
      const v = crop.cy - crop.demi + ((j + 0.5) / N) * 2 * crop.demi
      pts++
      let n = 0, zs = []
      for (const t of dess) {
        const m = 2 ** t.z
        const x0 = t.x / m, y0 = t.y / m, x1 = (t.x + 1) / m, y1 = (t.y + 1) / m
        if (u < x0 || u >= x1 || v < y0 || v >= y1) continue
        if (t._partiel) {
          const qi = ((u - x0) / (x1 - x0) >= 0.5 ? 1 : 0) | (((v - y0) / (y1 - y0) >= 0.5 ? 1 : 0) << 1)
          if (!(t._partiel & (1 << qi))) continue
        }
        n++; zs.push(t.z)
      }
      if (n === 0) { trous++; if (trousListe.length < 40) trousListe.push([+u.toFixed(6), +v.toFixed(6)]) }
      if (n > 1) doubles++
      for (const z of zs) parNiveau[z] = (parNiveau[z] || 0) + 1
    }
    return { pts, trous, doubles, parNiveau, trousListe }
  }
  // segments d'une tuile : G tel que (G+1)² nœuds de grille ; on le lit sur le maillage
  // (les groupes de quadrants posent 5 groupes ; sans eux, on suppose 64/32).
  const segTuile = (z) => (z <= 2 ? 64 : z <= 3 ? 48 : z <= 5 ? 32 : 24) // = segmentsTuile (monde/maillage-tuile.js)
  S.latLon = (x, y, z) => { const n = 2 ** z; const lon = (x / n) * 360 - 180; const lat = (Math.atan(Math.sinh(Math.PI * (1 - (2 * y) / n))) * 180) / Math.PI; return { lat, lon } }
  const origBuild = g._buildMesh.bind(g)
  g._buildMesh = function (t, ...r) {
    const res = origBuild(t, ...r)
    if (t.mesh) { t.mesh.userData.fondCle = this._cleFondPosee ?? null; t.mesh.userData.batiFrame = this.frame; t.mesh.userData.avecFond = !!this._fondCrop }
    return res
  }
  // toutes les tuiles DESSINÉES (hors crop aussi) : la profondeur au nœud central,
  // et son ancêtre z8 (le plancher de la bathymétrie GEBCO sur disque)
  S.tuilesVisibles = () => {
    const out = []
    for (const t of g.tiles.values()) {
      if (!t.mesh || !t.mesh.visible) continue
      const pos = t.mesh.geometry?.attributes?.position
      if (!pos) continue
      const G = segTuile(t.z), o = t.mesh.position, a = pos.array
      const echelle = (g.radius / 6371008.8) * g.exaggeration
      const k = ((G / 2) * (G + 1) + G / 2) * 3
      const centreM = +((Math.hypot(a[k] + o.x, a[k + 1] + o.y, a[k + 2] + o.z) - g.radius) / echelle).toFixed(1)
      const d = t.z - 8
      out.push({ z: t.z, x: t.x, y: t.y, centreM, z8: d >= 0 ? `${t.x >> d}/${t.y >> d}` : null, z7: t.z >= 7 ? `${t.x >> (t.z - 7)}/${t.y >> (t.z - 7)}` : null })
    }
    return out
  }
  S.tuilesCrop = () => {
    const crop = g._crop
    if (!crop) return null
    const out = []
    for (const t of g.tiles.values()) {
      const m = 2 ** t.z
      const x0 = t.x / m, y0 = t.y / m, x1 = (t.x + 1) / m, y1 = (t.y + 1) / m
      if (x1 <= crop.cx - crop.demi || x0 >= crop.cx + crop.demi || y1 <= crop.cy - crop.demi || y0 >= crop.cy + crop.demi) continue
      let hmin = null, hmax = null
      const geo = t.mesh?.geometry
      const pos = geo?.attributes?.position
      if (pos) {
        // la hauteur DESSINÉE, dans la monnaie de `hauteurMaillee` : sommets en
        // RTC (`mesh.position` porte l'origine), rayon − R_GLOBE, / échelle.
        // Les nœuds de la grille seulement ((G+1)² premiers), la jupe est après.
        hmin = Infinity; hmax = -Infinity
        const a = pos.array, o = t.mesh.position
        const echelle = (g.radius / 6371008.8) * g.exaggeration
        const n = Math.min(pos.count, (segTuile(t.z) + 1) ** 2)
        for (let i = 0; i < n; i++) {
          const h = (Math.hypot(a[i * 3] + o.x, a[i * 3 + 1] + o.y, a[i * 3 + 2] + o.z) - g.radius) / echelle
          if (h < hmin) hmin = h; if (h > hmax) hmax = h
        }
      }
      // la profondeur au NŒUD CENTRAL (12,12) de la grille 25×25, et celle du champ au même point
      let centreM = null, champM = null
      if (pos) {
        const G = segTuile(t.z), o = t.mesh.position, a = pos.array
        const echelle = (g.radius / 6371008.8) * g.exaggeration
        const k = ((G / 2) * (G + 1) + G / 2) * 3
        centreM = +((Math.hypot(a[k] + o.x, a[k + 1] + o.y, a[k + 2] + o.z) - g.radius) / echelle).toFixed(1)
        const f = g._fondCrop
        if (f) {
          const c = S.latLon(t.x + 0.5, t.y + 0.5, t.z)
          const N = f.cote - 1
          const fi = ((c.lon - f.emprise.ouest) / (f.emprise.est - f.emprise.ouest)) * N
          const fj = ((c.lat - f.emprise.nord) / (f.emprise.sud - f.emprise.nord)) * N
          const i0 = Math.max(0, Math.min(N, Math.round(fi))), j0 = Math.max(0, Math.min(N, Math.round(fj)))
          champM = +f.valeurs[j0 * f.cote + i0].toFixed(1)
        }
      }
      out.push({ z: t.z, x: t.x, y: t.y, etat: t.state, mesh: !!t.mesh, visible: !!(t.mesh && t.mesh.visible), partiel: t._partiel || 0, hminM: hmin === null ? null : +hmin.toFixed(1), hmaxM: hmax === null ? null : +hmax.toFixed(1), centreM, champM, heights: !!t.heights, fondCle: t.mesh?.userData?.fondCle ?? null, bati: t.mesh?.userData?.batiFrame ?? null })
    }
    return out
  }
  S.etat = () => ({
    frame: g.frame, crop: g._crop ? { ...g._crop } : null, zCible: g._zCropCible, zServi: g._zCropServi,
    plancher: g._plancherJupeCrop, baseY: g._baseYCrop, R: g.radius, rPlancher: g._parois ? g._rayonPlancherCrop({ z: 0, x: 0, y: 0 }) : null,
    parois: !!g._parois, provisoire: !!g._parois?.userData?.provisoire, cropSeul: g._cropSeul, drawn: g._drawn, partiels: g._nPartiels,
    file: g.queue?.length, vol: g.inFlight, busy: !!e.modes.busy, mode: e.modes.mode, alt: e.altitudeCadrageM?.(),
    cartouche: !!e.groundInfo?.group?.visible,
    fondCrop: g._fondCrop ? { ...g._fondCrop } : null, exag: g.exaggeration,
  })
  const origUpdate = g.update.bind(g)
  g.update = function (...a) {
    const r = origUpdate(...a)
    if (S.actif) {
      const c = S.couverture(24)
      S.images.push({ frame: g.frame, trous: c ? c.trous : null, doubles: c ? c.doubles : null, drawn: g._drawn, partiels: g._nPartiels, zServi: g._zCropServi, file: g.queue?.length, vol: g.inFlight })
      if (S.images.length > 4000) S.images.shift()
    }
    return r
  }
  return { ok: true }
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
  const journal = { etiquette: ETIQ, port: PORT, lat: LAT, lon: LON, z: Z, date: new Date().toISOString(), paliers: [] }
  journal.instrument = await page.evaluate(INSTRUMENTER)
  await page.waitForFunction("!!document.getElementById('loading')?.classList.contains('hidden')", { timeout: 240000 })
  await page.keyboard.press('Escape'); await dodo(500)
  await page.evaluate(() => { document.body.classList.remove('ce-hub'); document.querySelector('.ce-hubveil')?.remove(); document.querySelectorAll('.ce-elemwrap').forEach((n) => n.remove()) })
  await page.waitForFunction('!(window.__exp.modes && (window.__exp.modes.busy || window.__exp.modes.travel))', { timeout: 60000, polling: 200 }).catch(() => {})
  await dodo(1500)
  await page.evaluate(() => { window.__exp.params.grain = 0; window.__tro.actif = true })
  if (LATENCE > 0) {
    const cdp = await page.target().createCDPSession()
    await cdp.send('Network.enable')
    await cdp.send('Network.emulateNetworkConditions', { offline: false, latency: LATENCE, downloadThroughput: -1, uploadThroughput: -1 })
  }
  const lire = () => page.evaluate(() => window.__tro.etat())
  const releve = async (nom) => {
    const etat = await lire()
    const couv = await page.evaluate(() => window.__tro.couverture(48))
    const tuiles = await page.evaluate(() => window.__tro.tuilesCrop())
    await page.screenshot({ path: path.join(SORTIE, `${nom}.png`) })
    const p = { nom, etat, couv, nTuiles: tuiles ? tuiles.length : null }
    journal.paliers.push(p)
    fs.writeFileSync(path.join(SORTIE, `${nom}.json`), JSON.stringify({ etat, couv, tuiles }, null, 1))
    console.log(`${nom} · mode ${etat.mode} alt ${Math.round(etat.alt ?? -1)} m · crop ${etat.crop ? 'oui' : 'non'} zCible ${etat.zCible} zServi ${etat.zServi} · drawn ${etat.drawn} partiels ${etat.partiels} · trous ${couv ? couv.trous + '/' + couv.pts : '-'} doubles ${couv ? couv.doubles : '-'} niveaux ${couv ? JSON.stringify(couv.parNiveau) : '-'} · cartouche ${etat.cartouche}`)
    return p
  }

  // LA POSE DE LA VIDÉO : le bloc entier dans le cadre, vue de trois quarts
  // (q_028–q_041 d'Adrien). Altitude ~1,1 × largeur du crop, 35°, cap 15°.
  const cadrer = async (elev = 35, az = 15) => {
    await page.evaluate(async (elevDeg, azDeg) => {
      const e = window.__exp, cam = e.camera, ct = e.controls, g = e.globe
      const EARTH = 6371008.8
      const crop = g._crop
      if (!crop) return
      const lat = e.modes?.lat ?? 0
      const cropM = crop.demi * 2 * Math.PI * EARTH * Math.cos((lat * Math.PI) / 180)
      const a = cropM * 1.1
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
      const p = (elevDeg * Math.PI) / 180, azr = (azDeg * Math.PI) / 180
      cam.position.set(ct.target.x + d * Math.cos(p) * Math.sin(azr), ct.target.y + d * Math.sin(p), ct.target.z + d * Math.cos(p) * Math.cos(azr))
      cam.lookAt(ct.target)
      ct.update?.()
    }, elev, az)
    await dodo(300)
  }

  await page.evaluate((a, b, z) => window.__exp.modes.flyTo(a, b, z), LAT, LON, Z).catch((er) => { journal.flyToErreur = String(er) })
  await page.waitForFunction('!(window.__exp.modes.busy || window.__exp.modes.travel)', { timeout: 90000, polling: 200 }).catch(() => { journal.busyApresVol = true })
  journal.calmeArrivee = await attendreCalme(page, 45000)
  await dodo(800)
  await releve(`01-arrivee-z${Z}`)
  await cadrer(35, 15)
  await dodo(300)
  await releve(`02-cadre-300ms`)
  journal.calmeCadre = await attendreCalme(page, 45000)
  await dodo(800)
  await releve(`03-cadre-calme`)
  // 20 images consécutives au repos (piège : cycle de période 4)
  const t20 = await page.evaluate(async () => { const S = window.__tro; const d = S.images.length; await new Promise((r) => setTimeout(r, 1200)); return S.images.slice(d) })
  journal.repos20 = t20
  console.log(`   repos : ${t20.length} images, trous ${t20.map((x) => x.trous).join(',')}`)

  if (A.includes('--bandes')) {
    // LES BANDES PÂLES (q_017–q_027) : le geste d'Adrien — bloc z12 cadré de
    // trois quarts, puis 3 crans arrière en < 1 s (WIDENING → z11), puis on
    // regarde la mer de dessus en glissant. À chaque relevé : le repère des
    // parois contre `_crop`, provisoire ou non, et ce que la caméra voit.
    const lireParois = () => page.evaluate(() => {
      const e = window.__exp, g = e.globe, p = g._parois
      const r = p?.userData?.repere ?? null, c = g._crop
      const boite = p?.geometry?.boundingBox ?? (p?.geometry?.computeBoundingBox(), p?.geometry?.boundingBox)
      return { frame: g.frame, crop: c ? { cx: c.cx, cy: c.cy, demi: c.demi, zoom: c.zoom } : null, repere: r, memeRepere: !!(r && c && r.cx === c.cx && r.cy === c.cy && r.demi === c.demi), provisoire: !!p?.userData?.provisoire, paroisVisible: !!p?.visible, busy: !!e.modes.busy, travel: !!e.modes.travel, zServi: g._zCropServi, zCible: g._zCropCible, alt: e.altitudeCadrageM?.(), cartouche: !!e.groundInfo?.group?.visible, nParoisDansScene: (() => { let n = 0; g.group.parent?.traverse?.((o) => { if (o.userData && o.userData.repere && o.isMesh) n++ }); return n })() }
    })
    journal.bandes = []
    const ecartsMer = async () => {
      const cle = await page.evaluate(() => window.__exp.globe._cleFondPosee ?? null)
      const tuiles = (await page.evaluate(() => window.__tro.tuilesCrop())) || []
      const vis = tuiles.filter((t) => t.visible)
      const faux = vis.filter((t) => t.champM !== null && t.champM < -50 && Math.abs(t.centreM - t.champM) > 50)
      console.log(`      fond ${cle} · dessinées ${vis.length} · mer en désaccord avec le champ : ${faux.length} → ${faux.map((t) => `${t.z}/${t.x}/${t.y} centre ${t.centreM} champ ${t.champM} h=${t.heights} clé=${t.fondCle === cle ? 'POSÉE' : JSON.stringify(t.fondCle)} bâti@${t.bati}`).join(' | ')}`)
      return { cle, faux, dessinees: vis.length }
    }
    const note = async (nom) => { const r = await lireParois(); r.nom = nom; r.mer = await ecartsMer(); journal.bandes.push(r); console.log(`   ${nom} · crop z${r.crop?.zoom} demi ${r.crop?.demi} · parois ${r.repere ? 'z' + r.repere.zoom + ' demi ' + r.repere.demi : 'aucune'} · même repère ${r.memeRepere} · provisoire ${r.provisoire} · busy ${r.busy} travel ${r.travel} · zServi ${r.zServi} · alt ${Math.round(r.alt ?? -1)} · murs dans la scène ${r.nParoisDansScene}`); return r }
    await note('B0-repos-z12')
    // le dessus : caméra à la verticale, comme q_017 → q_027
    const dessus = async () => page.evaluate(() => { const e = window.__exp, cam = e.camera, ct = e.controls; const d = cam.position.distanceTo(ct.target); const up = ct.target.clone().normalize(); cam.position.copy(ct.target).addScaledVector(up, d); cam.lookAt(ct.target); ct.update?.() })
    for (let i = 0; i < 3; i++) { await page.evaluate(() => window.__exp.modes.cranZoom(-1)); await dodo(150) }
    for (const ms of [300, 1000, 2000, 3500, 6000]) {
      await dodo(ms - (journal.bandes.length > 1 ? journal.bandes[journal.bandes.length - 1].ms || 0 : 0))
      const r = await note(`B1-sortie-${ms}ms`); r.ms = ms
      await page.screenshot({ path: path.join(SORTIE, `B1-sortie-${String(ms).padStart(4, '0')}ms.png`) })
    }
    // LE DESSUS (q_017 → q_027) : quasi-nadir, cap tourné de 25° comme la vidéo,
    // le bloc entier dans le cadre — puis A/B parois cachées et mer cachée : qui
    // dessine les bandes pâles ?
    await cadrer(86, 25); await dodo(800)
    await note('B2-dessus')
    await page.screenshot({ path: path.join(SORTIE, 'B2-dessus.png') })
    await page.evaluate(() => window.__exp.globe.setParoisVisibles(false)); await dodo(300)
    await page.screenshot({ path: path.join(SORTIE, 'B2b-dessus-sans-parois.png') })
    await page.evaluate(() => window.__exp.globe.setParoisVisibles(true)); await dodo(300)
    await page.evaluate(() => { const m = window.__exp.globe._mer; if (m) m.visible = false }); await dodo(300)
    await page.screenshot({ path: path.join(SORTIE, 'B2c-dessus-sans-mer.png') })
    await page.evaluate(() => { const m = window.__exp.globe._mer; if (m) m.visible = true }); await dodo(300)
    await page.screenshot({ path: path.join(SORTIE, 'B2d-dessus-temoin.png') })
    // LE DEHORS ALLUMÉ (VIE : la molette en dézoom rallume le dehors) — c'est
    // l'état des images q_017 → q_027 : la mer du globe autour du bloc prend la
    // même teinte que celle du crop, et il ne reste du bloc que son arête.
    // ⚠️ `cranZoom(-1)` n'est PAS la molette : VIE ne rallume le dehors que sous
    // l'intention de sortie (la molette en dézoom). On envoie donc de VRAIES
    // molettes par CDP, au centre de la toile — deltaY > 0 = dézoom.
    {
      const cdp = await page.target().createCDPSession()
      await cdp.send('Input.dispatchMouseEvent', { type: 'mouseMoved', x: LARGEUR / 2, y: HAUTEUR / 2 })
      for (let i = 0; i < 3; i++) { await cdp.send('Input.dispatchMouseEvent', { type: 'mouseWheel', x: LARGEUR / 2, y: HAUTEUR / 2, deltaX: 0, deltaY: 120 }); await dodo(90) }
      await dodo(700)
    }
    await note('B7-dehors-allume')
    await page.screenshot({ path: path.join(SORTIE, 'B7-dehors-allume.png') })
    await page.evaluate(() => window.__exp.globe.setParoisVisibles(false)); await dodo(300)
    await page.screenshot({ path: path.join(SORTIE, 'B7b-dehors-sans-parois.png') })
    await page.evaluate(() => window.__exp.globe.setParoisVisibles(true)); await dodo(300)
    await page.screenshot({ path: path.join(SORTIE, 'B7c-dehors-temoin.png') })
    journal.dehors = await page.evaluate(() => { const e = window.__exp, g = e.globe; return { estompePlein: g.estompePlein?.(), cropSeul: g._cropSeul, uCropOn: g.uniforms?.uCropOn?.value, dehorsAllume: g.uniforms?.uDehorsAllume?.value ?? null } })
    // B8 : les MARCHES entre tuiles voisines de même niveau, et leur ancêtre z8
    const vis = await page.evaluate(() => window.__tro.tuilesVisibles())
    const parCle = new Map(vis.map((t) => [`${t.z}/${t.x}/${t.y}`, t]))
    const marches = []
    for (const t of vis) {
      if (t.centreM > 0) continue
      for (const [dx, dy] of [[1, 0], [0, 1]]) {
        const v = parCle.get(`${t.z}/${t.x + dx}/${t.y + dy}`)
        if (!v || v.centreM > 0) continue
        const d = Math.abs(t.centreM - v.centreM)
        if (d > 150) marches.push({ a: `${t.z}/${t.x}/${t.y}`, b: `${v.z}/${v.x}/${v.y}`, dM: +d.toFixed(0), z8a: t.z8, z8b: v.z8, memeZ8: t.z8 === v.z8, ha: t.centreM, hb: v.centreM })
      }
    }
    journal.marches = marches
    const memes = marches.filter((m) => m.memeZ8).length
    console.log(`   B8 : ${vis.length} tuiles dessinées · marches > 150 m entre voisines de même niveau : ${marches.length} (dont ${memes} sous le MÊME ancêtre z8) → ${marches.slice(0, 12).map((m) => `${m.a}(${m.ha})|${m.b}(${m.hb}) z8 ${m.z8a}${m.memeZ8 ? '' : ' vs ' + m.z8b}`).join(' ; ')}`)
    console.log(`   dehors : ${JSON.stringify(journal.dehors)}`)
    // le glissé vers la mer (sud) : on déplace la cible comme un drag, en 8 pas
    for (let i = 0; i < 8; i++) {
      await page.evaluate(() => { const e = window.__exp, ct = e.controls, cam = e.camera; const d = cam.position.clone().sub(ct.target); const sud = ct.target.clone().normalize().cross(new (cam.position.constructor)(0, 1, 0)).normalize(); /* est */ const nord = ct.target.clone().normalize().cross(sud).normalize(); ct.target.addScaledVector(nord, -0.0004); cam.position.copy(ct.target).add(d); ct.update?.() })
      await dodo(250)
    }
    await dodo(800)
    await note('B3-glisse-sud')
    await page.screenshot({ path: path.join(SORTIE, 'B3-glisse-sud.png') })
    // A/B : parois cachées, puis cartouche caché — qui porte les bandes ?
    await page.evaluate(() => window.__exp.globe.setParoisVisibles(false)); await dodo(300)
    await page.screenshot({ path: path.join(SORTIE, 'B4-sans-parois.png') })
    await page.evaluate(() => window.__exp.globe.setParoisVisibles(true)); await dodo(300)
    await page.evaluate(() => window.__exp.groundInfo.setVisible(false)); await dodo(300)
    await page.screenshot({ path: path.join(SORTIE, 'B5-sans-cartouche.png') })
    await page.evaluate(() => window.__exp.groundInfo.setVisible(true)); await dodo(300)
    await page.screenshot({ path: path.join(SORTIE, 'B6-temoin.png') })
    await note('B6-temoin')
    journal.erreurs = erreurs
    fs.writeFileSync(path.join(SORTIE, 'journal.json'), JSON.stringify(journal, null, 1))
    await nav.close()
    return
  }
  if (A.includes('--court')) {
    // A/B à la même seconde : parois cachées → si le rectangle rouge disparaît, c'est la plaque
    await page.evaluate(() => window.__exp.globe.setParoisVisibles(false)); await dodo(400)
    await page.screenshot({ path: path.join(SORTIE, '03b-cadre-sans-parois.png') })
    await page.evaluate(() => window.__exp.globe.setParoisVisibles(true)); await dodo(400)
    await page.screenshot({ path: path.join(SORTIE, '03c-cadre-temoin.png') })
    const et = await lire()
    const tuiles = await page.evaluate(() => window.__tro.tuilesCrop())
    const sous = tuiles.filter((t) => t.visible && t.hminM !== null && et.fondCrop && t.hminM < -et.fondCrop.profMaxM)
    const cleActuelle = await page.evaluate(() => window.__exp.globe._cleFondPosee ?? null)
    const vis = tuiles.filter((t) => t.visible)
    const autreFond = vis.filter((t) => t.fondCle !== cleActuelle)
    console.log(`   clé du fond posé : ${cleActuelle}`)
    console.log(`   tuiles dessinées bâties sur un AUTRE fond : ${autreFond.length}/${vis.length} → ${autreFond.map((t) => `${t.z}/${t.x}/${t.y} centre ${t.centreM} champ ${t.champM} h=${t.heights} clé=${t.fondCle}`).join(' | ')}`)
    const ecart = vis.filter((t) => t.centreM !== null && t.champM !== null && Math.abs(t.centreM - t.champM) > 50)
    console.log(`   tuiles dont le centre s'écarte du champ de > 50 m : ${ecart.length}/${vis.length} → ${ecart.map((t) => `${t.z}/${t.x}/${t.y} ${t.centreM} vs ${t.champM}`).join(' | ')}`)
    journal.autreFond = autreFond; journal.ecart = ecart
    console.log(`   fondCrop ${JSON.stringify({ ...et.fondCrop, valeurs: undefined })} · exag ${et.exag} · tuiles dessinées ${tuiles.filter((t) => t.visible).length} · hmin global ${Math.min(...tuiles.filter((t) => t.visible).map((t) => t.hminM))} m · SOUS le plancher : ${sous.length} → ${sous.map((t) => `${t.z}/${t.x}/${t.y}:${t.hminM}`).join(' ')}`)
    journal.sousPlancher = sous
    journal.images = await page.evaluate(() => window.__tro.images)
    journal.erreurs = erreurs
    fs.writeFileSync(path.join(SORTIE, 'journal.json'), JSON.stringify(journal, null, 1))
    await nav.close()
    return
  }
  // LA SORTIE MOLETTE : 3 crans arrière en < 1 s → WIDENING (globe, sans crop)
  for (let i = 0; i < 3; i++) { await page.evaluate(() => window.__exp.modes.cranZoom(-1)); await dodo(120) }
  await dodo(1500)
  await page.waitForFunction('!(window.__exp.modes.busy || window.__exp.modes.travel)', { timeout: 90000, polling: 200 }).catch(() => { journal.busyApresSortie = true })
  journal.calmeSortie = await attendreCalme(page, 45000)
  await dodo(800)
  await releve(`04-sortie-globe`)
  journal.sortie = await page.evaluate(() => {
    const e = window.__exp, gi = e.groundInfo, g = e.globe
    const planes = []
    gi.group.traverse((o) => { if (o.isMesh) { const s = new (o.position.constructor)(); o.getWorldPosition(s); planes.push({ nom: o.name || o.userData?.role || '', vis: o.visible, taille: [o.scale.x, o.scale.y], geo: o.geometry?.parameters ? [o.geometry.parameters.width, o.geometry.parameters.height] : null, pos: [s.x, s.y, s.z].map((v) => +v.toFixed(3)) }) } })
    return { mode: e.modes.mode, cartoucheVisible: gi.group.visible, groupPos: gi.group.position.toArray(), baseYCrop: g.baseYCrop, crop: g._crop ? { ...g._crop } : null, parois: !!g._parois, socleVisible: !!e.plinth?.group?.visible, nPlanes: planes.length, planesVisibles: planes.filter((p) => p.vis).length, planes: planes.slice(0, 12), cam: e.camera.position.toArray().map((v) => +v.toFixed(3)), cible: e.controls.target.toArray().map((v) => +v.toFixed(3)) }
  })
  console.log(`   sortie : mode ${journal.sortie.mode} · cartouche visible ${journal.sortie.cartoucheVisible} (${journal.sortie.planesVisibles}/${journal.sortie.nPlanes} plans) · baseYCrop ${journal.sortie.baseYCrop} · crop ${!!journal.sortie.crop} · parois ${journal.sortie.parois}`)
  // vue de dessus : la caméra regarde la mer au sud de l'île (q_020–q_027)
  await page.evaluate((a, b) => window.__exp.modes.flyTo(a, b, null), LAT - 0.25, LON - 0.1).catch(() => {})
  await page.waitForFunction('!(window.__exp.modes.busy || window.__exp.modes.travel)', { timeout: 90000, polling: 200 }).catch(() => {})
  await dodo(1500)
  await releve(`05-globe-mer`)
  journal.globeMer = await page.evaluate(() => { const e = window.__exp; return { mode: e.modes.mode, cartoucheVisible: e.groundInfo.group.visible, baseYCrop: e.globe.baseYCrop, crop: !!e.globe._crop } })
  console.log(`   globe-mer : ${JSON.stringify(journal.globeMer)}`)

  // LE RETOUR DANS LE CROP : des crans avant jusqu'au crop, puis le cadre entier
  journal.retour = []
  for (let i = 1; i <= CRANS; i++) {
    await page.evaluate(() => window.__exp.modes.cranZoom(1))
    await dodo(400)
    const e = await lire()
    journal.retour.push({ i, mode: e.mode, crop: !!e.crop, alt: e.alt })
    if (e.crop) break
  }
  await page.waitForFunction('!(window.__exp.modes.busy || window.__exp.modes.travel)', { timeout: 90000, polling: 200 }).catch(() => {})
  await dodo(500)
  await releve(`06-retour-crop-brut`)
  await cadrer(35, 15)
  await dodo(300)
  await releve(`07-retour-cadre-300ms`)
  journal.calmeRetour = await attendreCalme(page, 45000)
  await dodo(800)
  await releve(`08-retour-cadre-calme`)
  const t20b = await page.evaluate(async () => { const S = window.__tro; const d = S.images.length; await new Promise((r) => setTimeout(r, 1200)); return S.images.slice(d) })
  journal.repos20b = t20b
  console.log(`   repos retour : ${t20b.length} images, trous ${t20b.map((x) => x.trous).join(',')}`)
  journal.images = await page.evaluate(() => window.__tro.images)
  journal.erreurs = erreurs
  fs.writeFileSync(path.join(SORTIE, 'journal.json'), JSON.stringify(journal, null, 1))
  const im = journal.images
  const avecTrous = im.filter((x) => x.trous > 0).length
  console.log(`images relevées ${im.length} · avec trous ${avecTrous} · max trous ${Math.max(0, ...im.map((x) => x.trous || 0))}`)
  await nav.close()
}
lancer().catch((er) => { console.error(er); process.exit(1) })
