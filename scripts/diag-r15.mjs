// DIAGNOSTIC R15 — « en montagne, la caméra passe SOUS le bloc et l'écran devient vide ».
//
// ⛔ LECTURE SEULE SUR `src/`. Ce script navigue, appelle `flyTo` (le geste de
// l'usager, exposé par `__exp`), lit l'état, et mesure les PIXELS.
//
//   node scripts/diag-r15.mjs --port 5555 --etiquette AVANT
//   node scripts/diag-r15.mjs --port 5555 --dicho --lieu "29.6520,91.1721"
//   node scripts/diag-r15.mjs --port 5555 --recul --lieu "45.8326,6.8652"
//
// ══════════ CE QU'IL MESURE, ET POURQUOI DEUX GRANDEURS ET PAS UNE ══════════
//
// ① **LA MARGE GÉOMÉTRIQUE, EN MÈTRES RÉELS.** `camGlobe` est à
//    `(|position| − 100) × 63 710` mètres au-dessus de la mer DANS LA CONVENTION
//    EXAGÉRÉE ; on divise par l'exagération en vigueur pour revenir aux mètres
//    réels, et on retranche `globe.hauteurDessinee(lat, lon)` — la hauteur que
//    le GPU DESSINE au point visé. **Négatif ⇒ la caméra est sous le sol.**
//
// ② **UNE MESURE DE PIXELS.** Le jugement « écran vide » de l'attaquant est
//    OCULAIRE ; sans chiffre on ne saura pas quand c'est réparé. On rend :
//    · `energie` — le gradient absolu moyen de la luminance, sur 0..255. Un ciel
//      dégradé vaut ~0,1 ; une paroi de socle unie ~0,3 ; un relief dessiné > 3.
//      **C'est la grandeur qui sépare les trois états**, parce qu'« on ne voit
//      rien » veut dire « il n'y a pas de structure », que le vide soit bleu ou
//      terracotta.
//    · `fracDominante` — la fraction de pixels dans le bin de couleur le plus
//      peuplé (quantifié 5 bits/canal). Un cadre uni la met au-dessus de 0,5.
//    · `nCouleurs` — le nombre de bins peuplés.
//
// ⚠️ **LE DÉCODAGE SE FAIT DANS LA PAGE**, pas en Node : la capture CDP revient
// en base64, on la redonne à un `Image` + canevas 2D. Aucune dépendance ajoutée,
// et aucun décodeur PNG à écrire (donc à se tromper).

import fs from 'node:fs'
import path from 'node:path'
import { fileURLToPath } from 'node:url'

const RACINE = path.dirname(path.dirname(fileURLToPath(import.meta.url)))
const A = process.argv.slice(2)
const opt = (n, d) => { const i = A.indexOf(n); return i >= 0 && A[i + 1] !== undefined ? A[i + 1] : d }
const a = (n) => A.includes(n)
const PORT = Number(opt('--port', '5555'))
const ETIQ = opt('--etiquette', 'R15')
const ZOOMS = opt('--zooms', opt('--zoom', '16')).split(',').map(Number)
const ZOOM = ZOOMS[0]
const ATTENTE = Number(opt('--attente', '16000'))
const ICI = path.join(RACINE, '.banc', 'R15')
fs.mkdirSync(ICI, { recursive: true })

// Les six lieux : les cinq de l'attaquant + Amsterdam en témoin négatif, et le
// Sahara qui est son point « correct » le plus haut (884 m — la borne basse de
// son encadrement).
const LIEUX = [
  { nom: 'amsterdam', lat: 52.3676, lon: 4.9041 },
  { nom: 'sahara', lat: 25.45, lon: 30.55 },
  { nom: 'denver', lat: 39.7392, lon: -104.9903 },
  { nom: 'mexico', lat: 19.4326, lon: -99.1332 },
  { nom: 'cusco', lat: -13.532, lon: -71.9675 },
  { nom: 'lhassa', lat: 29.652, lon: 91.1721 },
  { nom: 'mont-blanc', lat: 45.8326, lon: 6.8652 },
]

function trouverChrome () {
  const donne = opt('--chrome', process.env.CHROME_PATH)
  if (donne) return donne
  const pistes = ['C:/Program Files/Google/Chrome/Application/chrome.exe', 'C:/Program Files (x86)/Google/Chrome/Application/chrome.exe', '/usr/bin/google-chrome']
  const t = pistes.find((p) => fs.existsSync(p))
  if (!t) { console.error('Chrome introuvable'); process.exit(2) }
  return t
}
async function chargerPuppeteer () {
  const pistes = [
    path.join(RACINE, 'node_modules/puppeteer-core/lib/puppeteer/puppeteer-core.js'),
    'C:/Dev/wt-f3/node_modules/puppeteer-core/lib/puppeteer/puppeteer-core.js',
  ]
  for (const p of pistes) if (fs.existsSync(p)) return (await import('file:///' + p.replace(/\\/g, '/'))).default
  console.error('puppeteer-core introuvable'); process.exit(2)
}
const dodo = (ms) => new Promise((r) => setTimeout(r, ms))

// ── ÉTAT, LU DANS LA PAGE ──────────────────────────────────────────────────
function lireEtat () {
  const e = window.__exp
  const R = 100, OMPU = 6371000 / 100
  const dem = e.dem
  const cg = e.camGlobe
  const p = cg.position
  const distG = Math.hypot(p.x, p.y, p.z)
  const exag = e.globe?.exaggeration ?? null
  const c = e.controls, cam = e.camera
  const distBloc = Math.hypot(cam.position.x - c.target.x, cam.position.y - c.target.y, cam.position.z - c.target.z)
  // le point VISÉ, en lat/lon : l'aplomb de la cible des contrôles
  let vise = null
  try { vise = e.terrain?.fenetreBornee?.emprise ? null : null } catch (er) { vise = null }
  // la hauteur DESSINÉE par le GPU sous le point visé et sous le centre du bloc
  const hDess = (la, lo) => { try { const v = e.globe?.hauteurDessinee?.(la, lo); return Number.isFinite(v) ? v : null } catch (er) { return null } }
  const camAltExagM = (distG - R) * OMPU
  const camAltReelleM = exag > 0 ? camAltExagM / exag : null
  const solCentre = dem ? hDess(dem.lat, dem.lon) : null
  return {
    mode: e.modes?.mode,
    zoom: dem?.zoom, demLat: dem?.lat, demLon: dem?.lon,
    extentMeters: dem?.extentMeters,
    meanM: dem?.meanM ?? null, minM: dem?.minM ?? null, maxM: dem?.maxM ?? null,
    exag,
    altCadrageM: e.altitudeCadrageM?.(),
    camY: cam.position.y,
    distBloc, minDistance: c.minDistance, maxDistance: c.maxDistance,
    camGlobeDist: distG,
    camAltExagM, camAltReelleM,
    solDessineCentreM: solCentre,
    // ⚡ LA MARGE : mètres RÉELS entre la caméra de fond et le sol dessiné.
    margeM: (camAltReelleM != null && solCentre != null) ? camAltReelleM - solCentre : null,
    uCropOn: e.globe?.uniforms?.uCropOn?.value ?? null,
    cropPose: !!e.veilleCrop?.pose,
    signature: e.veilleCrop?.signature ?? null,
    retard: document.querySelector('.ce-retard')?.textContent ?? null,
    tri: e.renderer?.info?.render?.triangles ?? null,
  }
}

// ── PIXELS, DÉCODÉS DANS LA PAGE ───────────────────────────────────────────
async function mesurePixels (page, b64) {
  return page.evaluate(async (data) => {
    const img = new Image()
    await new Promise((res, rej) => { img.onload = res; img.onerror = rej; img.src = 'data:image/png;base64,' + data })
    // ⚠️ **ON NE MESURE QUE LA FENÊTRE CENTRALE, ET C'EST OBLIGATOIRE.**
    // L'interface (barre du haut, panneau « Mes créations », barre du bas,
    // crédits) porte du texte à fort contraste : mesurée sur l'image entière,
    // l'énergie d'un écran VIDE vaut encore 4,19 — celle d'un bloc dessiné
    // 5,49. Le rapport est de 1,3 : ça ne sépare rien. Sur la fenêtre centrale
    // (x ∈ [0,20 ; 0,72[, y ∈ [0,11 ; 0,79[ — vérifiée sans aucun pixel d'IHM
    // aux sept lieux), il n'y a plus QUE la scène 3D.
    // ⚠️ **ET ON SOUS-ÉCHANTILLONNE FORT** : le fond porte un GRAIN, qui est du
    // bruit haute fréquence. Le canevas moyenne par aire en réduisant, ce qui
    // le supprime ; sans ça le grain compterait comme de la structure.
    const sx = Math.round(img.width * 0.20), sy = Math.round(img.height * 0.11)
    const sw = Math.round(img.width * 0.52), sh = Math.round(img.height * 0.68)
    const W = 128, H = Math.max(1, Math.round((sh / sw) * W))
    const cv = document.createElement('canvas'); cv.width = W; cv.height = H
    const ctx = cv.getContext('2d', { willReadFrequently: true })
    ctx.drawImage(img, sx, sy, sw, sh, 0, 0, W, H)
    const d = ctx.getImageData(0, 0, W, H).data
    const luma = new Float32Array(W * H)
    const bins = new Map()
    let sr = 0, sg = 0, sb = 0
    for (let i = 0, j = 0; i < d.length; i += 4, j++) {
      const r = d[i], g = d[i + 1], b = d[i + 2]
      luma[j] = 0.2126 * r + 0.7152 * g + 0.0722 * b
      sr += r; sg += g; sb += b
      const k = ((r >> 3) << 10) | ((g >> 3) << 5) | (b >> 3)
      bins.set(k, (bins.get(k) || 0) + 1)
    }
    let dom = 0
    for (const v of bins.values()) if (v > dom) dom = v
    let som = 0, n = 0
    for (let y = 0; y < H; y++) {
      for (let x = 0; x < W; x++) {
        const j = y * W + x
        if (x + 1 < W) { som += Math.abs(luma[j + 1] - luma[j]); n++ }
        if (y + 1 < H) { som += Math.abs(luma[j + W] - luma[j]); n++ }
      }
    }
    let m = 0
    for (let j = 0; j < luma.length; j++) m += luma[j]
    m /= luma.length
    let v = 0
    for (let j = 0; j < luma.length; j++) v += (luma[j] - m) * (luma[j] - m)
    return {
      energie: n ? som / n : 0,
      ecartType: Math.sqrt(v / luma.length),
      fracDominante: dom / (W * H),
      nCouleurs: bins.size,
      moyenne: [Math.round(sr / (W * H)), Math.round(sg / (W * H)), Math.round(sb / (W * H))],
    }
  }, b64)
}

// ── PILOTE ─────────────────────────────────────────────────────────────────
const puppeteer = await chargerPuppeteer()
const nav = await puppeteer.launch({
  executablePath: trouverChrome(),
  headless: true,
  args: ['--headless=new', '--no-sandbox', '--enable-unsafe-swiftshader', '--window-size=1280,900'],
})
const sortie = { etiquette: ETIQ, zoom: ZOOM, releves: [] }
const dossier = path.join(ICI, `img-${ETIQ}`)
fs.mkdirSync(dossier, { recursive: true })

try {
  const page = await nav.newPage()
  await page.setViewport({ width: 1280, height: 800 })
  const erreurs = []
  page.on('pageerror', (er) => erreurs.push(String(er.message).slice(0, 200)))
  await page.goto(`http://localhost:${PORT}/`, { waitUntil: 'domcontentloaded', timeout: 120000 })
  await page.waitForFunction(() => window.__exp?.modes && window.__exp?.globe, { timeout: 90000, polling: 100 })
  await dodo(9000)
  await page.keyboard.press('Escape')
  await dodo(1500)
  const client = await page.createCDPSession()
  const capture = async (nom) => {
    const b = await client.send('Page.captureScreenshot', { format: 'png' })
    fs.writeFileSync(path.join(dossier, nom + '.png'), Buffer.from(b.data, 'base64'))
    return mesurePixels(page, b.data)
  }

  const lieux = opt('--lieu', null)
    ? [{ nom: opt('--nom', 'lieu'), lat: Number(opt('--lieu').split(',')[0]), lon: Number(opt('--lieu').split(',')[1]) }]
    : LIEUX

  for (const L of lieux) {
   for (const ZM of ZOOMS) {
    const ok = await page.evaluate(async (la, lo, z) => {
      try { return !!(await window.__exp.modes.flyTo(la, lo, z)) } catch (er) { return 'err:' + er.message }
    }, L.lat, L.lon, ZM)
    await dodo(ATTENTE)
    const et = await lireDansPage(page)
    et.lieu = L.nom; et.demande = [L.lat, L.lon]; et.flyToOk = ok
    et.px = await capture(`${L.nom}-z${ZM}`)
    sortie.releves.push(et)
    console.log(
      `${(L.nom+" z"+ZM).padEnd(15)} sol=${fmt(et.meanM)}m alt=${fmt(et.altCadrageM)}m camAlt=${fmt(et.camAltReelleM)}m ` +
      `solDess=${fmt(et.solDessineCentreM)}m MARGE=${fmt(et.margeM)}m | energie=${(et.px.energie).toFixed(3)} sigma=${et.px.ecartType.toFixed(2)} ` +
      `dom=${(et.px.fracDominante * 100).toFixed(1)}% nCoul=${et.px.nCouleurs} rgb=${et.px.moyenne}`
    )

    // ── LE CONTRE-ESSAI DE L'ATTAQUANT, INSTRUMENTÉ ────────────────────────
    if (a('--recul')) {
      const r = await page.evaluate((f) => {
        const x = window.__exp, c = x.camera, t = x.controls.target
        const d0 = Math.hypot(c.position.x - t.x, c.position.y - t.y, c.position.z - t.z)
        const avant = { d: d0, camGlobeDist: Math.hypot(x.camGlobe.position.x, x.camGlobe.position.y, x.camGlobe.position.z), max: x.controls.maxDistance }
        c.position.set(t.x + (c.position.x - t.x) * f, t.y + (c.position.y - t.y) * f, t.z + (c.position.z - t.z) * f)
        x.majCameraFond()
        const dSansUpdate = Math.hypot(c.position.x - t.x, c.position.y - t.y, c.position.z - t.z)
        const camGlobeSansUpdate = Math.hypot(x.camGlobe.position.x, x.camGlobe.position.y, x.camGlobe.position.z)
        x.controls.update()
        x.majCameraFond()
        const dApresUpdate = Math.hypot(c.position.x - t.x, c.position.y - t.y, c.position.z - t.z)
        const camGlobeApresUpdate = Math.hypot(x.camGlobe.position.x, x.camGlobe.position.y, x.camGlobe.position.z)
        return { avant, dSansUpdate, camGlobeSansUpdate, dApresUpdate, camGlobeApresUpdate }
      }, Number(opt('--facteur', '4')))
      r.lieu = L.nom
      sortie.recul = r
      const OMPU = 63710
      console.log(`  RECUL ×${opt('--facteur', '4')} : dist ${r.avant.d.toFixed(3)} → (sans update) ${r.dSansUpdate.toFixed(3)} → (après controls.update) ${r.dApresUpdate.toFixed(3)}  [maxDistance=${r.avant.max}]`)
      console.log(`           camAltMer ${((r.avant.camGlobeDist - 100) * OMPU).toFixed(0)}m → ${((r.camGlobeSansUpdate - 100) * OMPU).toFixed(0)}m → ${((r.camGlobeApresUpdate - 100) * OMPU).toFixed(0)}m`)
    }

   }
    // ── LE DÉCALAGE RADIAL DE `camGlobe` SEULE, SANS TOUCHER À `src/` ──────
    //
    // ⚡ **L'ESSAI DÉCISIF.** On laisse la caméra du BLOC exactement où elle
    // est — donc tout l'état dérivé (estompage, veille du crop, near/far du
    // bloc, cadrage) est celui de l'application — et on ne déplace que la
    // caméra de FOND, radialement, de `h × exagération / 63 710` unités de
    // globe. C'est ce que ferait une ancre posée à l'altitude du sol au lieu du
    // niveau de la mer. On détourne `camGlobe.position.set`, que `majCameraFond`
    // appelle à chaque image : le décalage survit donc à la boucle de rendu.
    if (a('--decale')) {
      const hs = opt('--hauteurs', 'meanM').split(',')
      for (const h of hs) {
        const r = await page.evaluate((hh) => {
          const x = window.__exp
          const cg = x.camGlobe, p = cg.position
          x.__origSet ??= p.set.bind(p)
          const hM = hh === 'meanM' ? (x.dem?.meanM ?? 0) : Number(hh)
          const off = (hM * (x.globe?.exaggeration ?? 1)) / (6371000 / 100)
          p.set = (X, Y, Z) => { const rr = Math.hypot(X, Y, Z) || 1; const s = (rr + off) / rr; return x.__origSet(X * s, Y * s, Z * s) }
          return { hM, off }
        }, h)
        await dodo(2500)
        const et3 = await lireDansPage(page)
        et3.decaleM = r.hM; et3.decaleUnites = r.off
        et3.px = await capture(`${L.nom}-decale-${h}`)
        sortie.decale ??= []
        sortie.decale.push(et3)
        console.log(`  DÉCALE ${h}=${fmt(r.hM)}m → camAlt=${fmt(et3.camAltReelleM)}m MARGE=${fmt(et3.margeM)}m energie=${et3.px.energie.toFixed(3)} sigma=${et3.px.ecartType.toFixed(2)} nCoul=${et3.px.nCouleurs}`)
      }
      await page.evaluate(() => { const x = window.__exp; if (x.__origSet) { x.camGlobe.position.set = x.__origSet; delete x.__origSet } })
    }

    // ── LA DICHOTOMIE : où bascule l'écran, exactement ? ───────────────────
    if (a('--dicho')) {
      // On desserre `maxDistance` (DIAGNOSTIC — on ne corrige rien ici) et on
      // fait varier la hauteur de la caméra de bloc, en relevant la marge ET
      // l'énergie de l'image à chaque pas.
      const pts = []
      const FACTEURS = opt('--facteurs', '1,1.5,2,2.2,2.4,2.45,2.5,2.55,2.6,2.8,3,4').split(',').map(Number)
      for (const f of FACTEURS) {
        await page.evaluate((ff) => {
          const x = window.__exp, c = x.camera, t = x.controls.target
          x.__d0 ??= Math.hypot(c.position.x - t.x, c.position.y - t.y, c.position.z - t.z)
          x.__dir ??= (() => { const d = x.__d0; return { x: (c.position.x - t.x) / d, y: (c.position.y - t.y) / d, z: (c.position.z - t.z) / d } })()
          x.controls.maxDistance = 1e7
          const d = x.__d0 * ff
          c.position.set(t.x + x.__dir.x * d, t.y + x.__dir.y * d, t.z + x.__dir.z * d)
          c.updateMatrixWorld()
          x.majCameraFond()
        }, f)
        await dodo(900)
        const et2 = await lireDansPage(page)
        et2.px = await capture(`${L.nom}-dicho-f${String(f).replace('.', 'p')}`)
        et2.facteur = f
        pts.push(et2)
        console.log(`  f=${String(f).padStart(5)} camAlt=${fmt(et2.camAltReelleM)}m MARGE=${fmt(et2.margeM)}m energie=${et2.px.energie.toFixed(3)} sigma=${et2.px.ecartType.toFixed(2)} dom=${(et2.px.fracDominante * 100).toFixed(1)}%`)
      }
      sortie.dicho = pts
      await page.evaluate(() => { window.__exp.controls.maxDistance = 150; delete window.__exp.__d0; delete window.__exp.__dir })
    }
  }
  sortie.erreurs = erreurs
  fs.writeFileSync(path.join(ICI, `${ETIQ}.json`), JSON.stringify(sortie, null, 1))
  console.log(`→ .banc/R15/${ETIQ}.json  (${erreurs.length} erreur(s) de page)`)
} finally {
  await nav.close()
}

function fmt (v) { return v == null ? '—' : Math.round(v) }
async function lireDansPage (page) { return page.evaluate(lireEtat) }
