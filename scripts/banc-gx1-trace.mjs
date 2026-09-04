// BANC GX1 — LE TRACÉ GPX : sa POSITION et sa LECTURE.
//
// ⛔ CE BANC NE CORRIGE RIEN. Il mesure, il chiffre, il capture.
//
// ═══════════════════════════════════════════════════════════════════════════
// ⚠️ LA MÉTHODE, ET LE PREMIER TOUR DE CE BANC S'EST TROMPÉ SANS ELLE
// ═══════════════════════════════════════════════════════════════════════════
// Le premier tour comptait les pixels « vermillon » (r>120, r−b>55) sur la
// capture : il a rendu **44 102 pixels de tracé sur une image où il n'y a PAS
// DE TRACÉ** — les rampes hypsométriques de ShibuMap sont roses et saumon, et
// elles passent le test. Conclusion fausse : « 0 image sans tracé ».
//
// On mesure donc par DIFFÉRENCE, et sur une image FIGÉE :
//   ① la boucle rAF de l'application est CAPTURÉE (file d'attente, pas no-op —
//      trois autres modules appellent rAF, un simple remplacement tue la
//      chaîne) ; `tourner(n)` rend n images, puis le banc garde la main ;
//   ② image figée, le banc dessine DEUX fois par `composer.render()` : une
//      fois le tracé allumé, une fois éteint (`group.visible`), et compte les
//      pixels qui DIFFÈRENT. Aucune palette ne peut plus mentir.
//      ⛔ readPixels/drawImage sur le canevas rendent 0 ici (rendu par
//      composer) : les deux images passent par la CAPTURE D'ÉCRAN.
//   ③ 20 images consécutives au minimum (cycle de période 4 mesuré ici).
//
// CHEMIN FIXE, ET IL EST DIT : boot par défaut (mode sphère, flags de prod) →
// `__exp.loadGpxText(gpx)` (la porte de « Load GPX… ») → attente de pose →
// clic sur `.cb-play`, LE bouton Lecture de la barre de course. Aucun lien
// profond `#s=`, aucun `gotoCtl.go` (piège de mesure connu : zoom 32× plus
// serré sous une altitude d'apparence juste).
//
// EMPLOI
//   node scripts/banc-gx1-trace.mjs --port 9233 --etiquette mont-blanc
//   node scripts/banc-gx1-trace.mjs --gpx .banc/court.gpx --etiquette court
//
// ⚠️ `puppeteer-core` n'est PAS une dépendance du produit : passer son chemin
// par PUPPETEER_CORE, ou `npm i --no-save puppeteer-core@25.8.0`.

import fs from 'node:fs'
import path from 'node:path'
import { fileURLToPath, pathToFileURL } from 'node:url'

const RACINE = fileURLToPath(new URL('..', import.meta.url))
const A = process.argv.slice(2)
const opt = (n, d) => { const i = A.indexOf(n); return i >= 0 && A[i + 1] ? A[i + 1] : d }
const PORT = Number(opt('--port', '9233'))
const SORTIE = path.resolve(RACINE, opt('--sortie', '.banc/GX1'))
const GPX = path.resolve(RACINE, opt('--gpx', '.banc/marathon-mont-blanc-90km.gpx'))
const ETIQUETTE = opt('--etiquette', 'mont-blanc')
const BLOCS = Number(opt('--blocs', '30')) // relevés pendant la lecture
const IMAGES_PAR_BLOC = Number(opt('--parbloc', '20')) // images rAF entre deux relevés
const GARDE_PNG = Number(opt('--png', '8')) // 1 capture PNG conservée sur N
const ADRESSE = opt('--adresse', '')
fs.mkdirSync(SORTIE, { recursive: true })

const PP = 'C:/Users/adrie/AppData/Local/Temp/claude/G--My-Drive--GITHUB/ed4e3ecd-eb07-4312-a4ba-d4e3ef43c3f0/scratchpad/pp/node_modules/puppeteer-core/lib/puppeteer/puppeteer-core.js'
const puppeteer = (await import(pathToFileURL(process.env.PUPPETEER_CORE || PP).href)).default

function trouverChrome() {
  const donne = opt('--chrome', process.env.CHROME_PATH)
  if (donne) return donne
  const pistes = [
    'C:/Program Files/Google/Chrome/Application/chrome.exe',
    'C:/Program Files (x86)/Google/Chrome/Application/chrome.exe',
  ]
  const t = pistes.find((p) => fs.existsSync(p))
  if (!t) { console.error('Chrome introuvable — passe --chrome'); process.exit(2) }
  return t
}

const nav = await puppeteer.launch({
  executablePath: trouverChrome(), headless: 'new',
  args: ['--headless=new', '--hide-scrollbars', '--mute-audio', '--window-size=1440,1024',
    '--use-angle=d3d11', '--enable-gpu', '--ignore-gpu-blocklist', '--disable-dev-shm-usage'],
})
const page = await nav.newPage()
await page.setViewport({ width: 1440, height: 1024, deviceScaleFactor: 1 })
const erreurs = []
page.on('pageerror', (e) => { erreurs.push(String(e.message)); console.error('  [page] ' + e.message) })

const url = `http://127.0.0.1:${PORT}/${ADRESSE ? '?' + ADRESSE : ''}`
console.log('→ ' + url)
await page.goto(url, { waitUntil: 'load', timeout: 120000 })
await page.waitForFunction('window.__exp && window.__exp.gpxLayer', { timeout: 120000 })
await new Promise((r) => setTimeout(r, 6000))
await page.keyboard.press('Escape')
await new Promise((r) => setTimeout(r, 6000))

// ═════════════════ LA SONDE ═════════════════════════════════════════════════
await page.evaluate(() => {
  window.__gx1 = {}

  // ── la boucle de l'application, CAPTURÉE (file, pas no-op) ────────────────
  if (!window.__gx1.horloge) {
    const vrai = window.requestAnimationFrame.bind(window)
    let file = []
    window.__gx1.horloge = {
      vrai,
      tourner: (n) => new Promise((res) => {
        let reste = n
        const pas = () => {
          const lot = file; file = []
          if (!lot.length) return res(false)
          const t = performance.now()
          for (const cb of lot) cb(t)
          if (--reste <= 0) return res(true)
          vrai(pas)
        }
        vrai(pas)
      }),
    }
    window.requestAnimationFrame = (cb) => { file.push(cb); return file.length }
  }

  // ⚠️ LE GRAIN DE FILM EST TIRÉ AU HASARD À CHAQUE IMAGE — sans cette
  // coupure, deux images consécutives diffèrent sur ~340 000 pixels et aucune
  // mesure de différence ne veut plus rien dire (mesuré, premier tour).
  window.__exp.params.grain = 0
  window.__exp.params.animations = false

  window.__gx1.couche = () => window.__exp.gpxLayer.layers?.[0]?.gpx || null
  window.__gx1.rendre = () => { window.__exp.composer.render() }
  window.__gx1.traceVisible = (v) => {
    const c = window.__gx1.couche()
    if (c) c.group.visible = v
  }

  // décodage d'une capture PNG → tableau de pixels (le canevas 2D, PAS le WebGL)
  window.__gx1._pix = async (dataUrl) => {
    const img = await createImageBitmap(await (await fetch(dataUrl)).blob())
    const c = document.createElement('canvas')
    c.width = img.width; c.height = img.height
    c.getContext('2d').drawImage(img, 0, 0)
    return { d: c.getContext('2d').getImageData(0, 0, c.width, c.height).data, w: c.width, h: c.height }
  }
  // ⚠️ LA MESURE : combien de pixels le tracé POSE-T-IL réellement à l'écran.
  // Seuil 12/255 par canal : au-dessus du bruit du grain de film, très en
  // dessous du contraste d'un ruban vermillon sur une carte pâle.
  window.__gx1.diff = async (aUrl, bUrl) => {
    const a = await window.__gx1._pix(aUrl)
    const b = await window.__gx1._pix(bUrl)
    let n = 0, sx = 0, sy = 0, maxd = 0
    const N = Math.min(a.d.length, b.d.length)
    for (let i = 0; i < N; i += 4) {
      const dr = Math.abs(a.d[i] - b.d[i]), dv = Math.abs(a.d[i + 1] - b.d[i + 1]), db = Math.abs(a.d[i + 2] - b.d[i + 2])
      const m = Math.max(dr, dv, db)
      if (m > maxd) maxd = m
      if (m > 12) { const p = i / 4; n++; sx += p % a.w; sy += Math.floor(p / a.w) }
    }
    return { pixels: n, total: a.w * a.h, cx: n ? sx / n : null, cy: n ? sy / n : null, maxEcart: maxd }
  }

  window.__gx1.etat = (n = 24) => {
    const e = window.__exp
    const T = e.THREE
    const gl = e.gpxLayer
    const couche = window.__gx1.couche()
    const t = couche?.track
    const cam = e.camera
    const W = window.innerWidth, H = window.innerHeight
    const out = {
      mode: e.modes?.mode, busy: e.modes?.busy,
      lecture: gl.isPlaying?.(), headT: gl.headT, revealT: couche?._revealT,
      progress: couche?._rubanProgress?.value,
      groupeVisible: couche?.group?.visible,
      groupePos: couche ? couche.group.position.toArray() : null,
      fen: couche ? { x: couche._fen.x, z: couche._fen.z } : null,
      terrainFen: e.terrain?.fenetre ? { x: e.terrain.fenetre.x, z: e.terrain.fenetre.z } : null,
      camPos: cam.position.toArray(), camNear: cam.near, camFar: cam.far, camFov: cam.fov,
      alt: e.altitudeCadrageM ? e.altitudeCadrageM() : null,
      drone: !!e.drone?.active, poursuite: !!e.pilote?.poursuite, gpxFollow: !!e.params.gpxFollow,
      W, H,
    }
    if (couche?.ruban) {
      const m = couche.ruban
      m.geometry.computeBoundingSphere?.()
      out.ruban = {
        visible: m.visible, renderOrder: m.renderOrder, frustumCulled: m.frustumCulled,
        clip: couche.rubanMat?.clippingPlanes?.length || 0,
        nbSommets: m.geometry.getAttribute('position')?.count || 0,
        opacity: couche.rubanMat?.opacity, depthTest: couche.rubanMat?.depthTest,
        demiLargeurMonde: (couche.params.gpxWidth ?? 3) * 0.022,
      }
    } else out.ruban = null

    // ── LA TÊTE DE LECTURE, projetée ────────────────────────────────────────
    if (t?.world?.length > 1) {
      const w = t.world
      const pts = t.points
      const proj = (p) => {
        const v = new T.Vector3(p.x + couche.group.position.x, p.y, p.z + couche.group.position.z)
        const q = v.clone().project(cam)
        return { px: (q.x * 0.5 + 0.5) * W, py: (-q.y * 0.5 + 0.5) * H, z: q.z, d: cam.position.distanceTo(v) }
      }
      const iTete = Math.max(0, Math.min(w.length - 1, Math.round(gl.headT * (w.length - 1))))
      const pt = proj(w[iTete])
      out.tete = { i: iTete, ...pt, dansEcran: pt.px >= 0 && pt.px < W && pt.py >= 0 && pt.py < H && pt.z > -1 && pt.z < 1 }

      const ech = []
      const fen = e.terrain?.fenetre || { x: 0, z: 0 }
      const bloc = e.terrain?.blockFootprint?.()
      for (let k = 0; k < n; k++) {
        const i = Math.round((k / (n - 1)) * (w.length - 1))
        const p = w[i]
        const q = proj(p)
        let solTerrain = null
        try { solTerrain = e.terrain.sample(p.x - fen.x, p.z - fen.z) } catch { }
        ech.push({
          i, lat: pts[i]?.lat, lon: pts[i]?.lon, eleGpx: pts[i]?.ele,
          wx: p.x, wy: p.y, wz: p.z, px: q.px, py: q.py, zNdc: q.z, distCam: q.d,
          dansEcran: q.px >= 0 && q.px < W && q.py >= 0 && q.py < H && q.z > -1 && q.z < 1,
          solTerrain, ecartSol: solTerrain == null ? null : p.y - solTerrain,
          dansBloc: bloc ? (Math.abs(p.x - couche._fen.x) <= bloc.half && Math.abs(p.z - couche._fen.z) <= bloc.half) : null,
        })
      }
      // combien de sommets du tracé DEVRAIENT être à l'écran
      out.echDansEcran = ech.filter((x) => x.dansEcran).length
      out.ech = ech
      out.cumKm = t.cumKm[t.cumKm.length - 1]
      out.nbPoints = pts.length
      // ── ÉCHELLE ET POSITION : la vérité géodésique, en mètres ─────────────
      // Deux points éloignés du tracé : distance géodésique (haversine sur le
      // GPX) contre distance dans le monde dessiné × mètres-par-unité.
      const R = 6371008.8
      const hav = (a, b) => {
        const p1 = a.lat * Math.PI / 180, p2 = b.lat * Math.PI / 180
        const dp = p2 - p1, dl = (b.lon - a.lon) * Math.PI / 180
        const s = Math.sin(dp / 2) ** 2 + Math.cos(p1) * Math.cos(p2) * Math.sin(dl / 2) ** 2
        return 2 * R * Math.asin(Math.sqrt(s))
      }
      const i0 = 0, i1 = w.length - 1
      const dMonde = Math.hypot(w[i1].x - w[i0].x, w[i1].z - w[i0].z)
      const dTerre = hav(pts[i0], pts[i1])
      out.echelle = { dMonde, dTerre, metresParUnite: dMonde > 0 ? dTerre / dMonde : null }
    }
    return out
  }
})

const tourner = (n) => page.evaluate((k) => window.__gx1.horloge.tourner(k), n)
const gpxText = fs.readFileSync(GPX, 'utf8')
console.log(`GPX : ${path.basename(GPX)} (${(gpxText.length / 1024) | 0} Ko)`)

const journal = { etiquette: ETIQUETTE, gpx: path.basename(GPX), url, erreurs, releves: [] }

// ── UN RELEVÉ : image figée, tracé allumé / éteint, différence ──────────────
let nPng = 0
// ⚠️ **ON NE RAPPELLE JAMAIS `composer.render()` SOI-MÊME — MESURÉ.** Un rendu
// forcé hors de la boucle de l'application donne une image GLOBALEMENT
// différente (586 000 pixels sur 1 474 560, grain de film coupé) : `tick()`
// fait plus qu'un `render()` — passe de fond, caméra du fond, uniformes. Deux
// captures d'écran sans aucun rendu forcé, elles, ne diffèrent que de 2 550
// pixels. Le témoin A/A ci-dessous MESURE ce plancher à chaque relevé au lieu
// de le supposer : une image de mouvement de caméra, rien de plus.
async function releve(nom, { png = false } = {}) {
  const etat = await page.evaluate(() => window.__gx1.etat(24))
  await tourner(1)
  const a64 = await page.screenshot({ encoding: 'base64' })
  // ⓘ TÉMOIN A/A — une image de plus, rien de changé : c'est le mouvement de
  // la caméra et le grain, le plancher de bruit de CE relevé-ci.
  await tourner(1)
  const a2 = await page.screenshot({ encoding: 'base64' })
  // ⓑ le tracé éteint, une image de plus : ce qui disparaît est le tracé
  await page.evaluate(() => window.__gx1.traceVisible(false))
  await tourner(1)
  const b64 = await page.screenshot({ encoding: 'base64' })
  await page.evaluate(() => window.__gx1.traceVisible(true))
  await tourner(1)
  const d = await page.evaluate((a, b) => window.__gx1.diff(a, b),
    'data:image/png;base64,' + a2, 'data:image/png;base64,' + b64)
  const temoin = await page.evaluate((a, b) => window.__gx1.diff(a, b),
    'data:image/png;base64,' + a64, 'data:image/png;base64,' + a2)
  if (png) { fs.writeFileSync(path.join(SORTIE, `${ETIQUETTE}-${nom}.png`), Buffer.from(a64, 'base64')); nPng++ }
  return { nom, etat, trace: d, temoin }
}

// ═════════════════ ① CHARGEMENT ════════════════════════════════════════════
await page.evaluate((txt) => window.__exp.loadGpxText(txt), gpxText)
// le relief se construit sur la boucle rAF : on la fait tourner pour de vrai
for (let i = 0; i < 12; i++) { await tourner(120); await new Promise((r) => setTimeout(r, 1500)) }
journal.charge = await releve('01-charge', { png: true })
console.log(`chargé — pixels de tracé : ${journal.charge.trace.pixels}  (échantillons à l'écran ${journal.charge.etat.echDansEcran}/24)`)

// ═════════════════ ② LECTURE ═══════════════════════════════════════════════
const boutonVu = await page.evaluate(() => {
  const b = document.querySelector('.cb-play')
  if (!b) return { trouve: false }
  const r = b.getBoundingClientRect()
  return { trouve: true, visible: r.width > 0 && r.height > 0, x: r.x, y: r.y }
})
journal.boutonLecture = boutonVu
if (boutonVu.trouve) {
  await page.evaluate(() => {
    const b = document.querySelector('.cb-play')
    const r = b.getBoundingClientRect()
    b.dispatchEvent(new MouseEvent('click', { bubbles: true, clientX: r.x + r.width / 2, clientY: r.y + r.height / 2 }))
  })
} else {
  await page.keyboard.press('Space')
}
journal.apresClic = await page.evaluate(() => ({
  lecture: window.__exp.gpxLayer.isPlaying(), playingIndex: window.__exp.gpxLayer.playingIndex,
  mode: window.__exp.modes.mode, gpxFollow: window.__exp.params.gpxFollow,
}))
console.log('après le clic Lecture :', JSON.stringify(journal.apresClic))

for (let k = 0; k < BLOCS; k++) {
  await tourner(IMAGES_PAR_BLOC)
  const r = await releve(`lecture-${String(k).padStart(2, '0')}`, { png: k % GARDE_PNG === 0 })
  journal.releves.push(r)
  const e = r.etat
  console.log(`  ${String(k).padStart(2, '0')}  headT=${(e.headT ?? 0).toFixed(3)}  tracé=${String(r.trace.pixels).padStart(6)} px (bruit ${r.temoin.pixels})  attendus à l'écran=${e.echDansEcran}/24  tête=${e.tete?.dansEcran ? 'écran' : 'HORS'}  alt=${Math.round(e.alt || 0)} m`)
}

// ═════════════════ ③ APRÈS ═════════════════════════════════════════════════
await page.keyboard.press('Escape')
await tourner(60)
journal.apres = await releve('99-apres', { png: true })

fs.writeFileSync(path.join(SORTIE, `${ETIQUETTE}.json`), JSON.stringify(journal, null, 1))
const muettes = journal.releves.filter((r) => r.trace.pixels < 30)
const muettesAttendues = journal.releves.filter((r) => r.trace.pixels < 30 && r.etat.echDansEcran > 0)
console.log(`\n→ ${path.join(SORTIE, ETIQUETTE + '.json')}`)
console.log(`IMAGES SANS AUCUN PIXEL DE TRACÉ : ${muettes.length} / ${journal.releves.length}`)
console.log(`  … dont ${muettesAttendues.length} où des sommets du tracé SONT dans le champ de la caméra`)
await nav.close()
