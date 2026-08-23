// CE BANC VOIT-IL LE GPU, OU SEULEMENT LA SOUMISSION CPU ? — Tâche R6.
//
// ⛔ **CE QUI A CRÉÉ CE FICHIER.** Le tour de correction de R6 a reçu du
// coordinateur un constat qu'aucun des bancs du chantier n'avait vérifié :
//
// > *« Ces bancs mesurent le temps de SOUMISSION CPU, indiscernable du temps
// > sans barrière — alors que les correctifs mesurés n'ajoutent que du GPU. »*
//
// ⚠️ **Si c'est vrai, alors « le coût de D15 est indiscernable de zéro » ne dit
// PAS que le nuanceur est gratuit** : il dit que l'instrument ne peut pas le
// voir. La différence entre les deux est tout ce qui sépare une mesure d'une
// illusion, donc elle se tranche, elle ne se suppose pas.
//
// ══════════ LE PROTOCOLE, ET IL TIENT EN UNE LIGNE ══════════════════════════
//
// On garde **exactement** le banc de `scripts/banc-relief-monde.mjs` — boucle
// serrée de `composer.render(0)`, `readPixels(1×1)` aux deux bouts, chauffe
// jetée, médiane de cinq blocs — et on fait varier **le nombre de FRAGMENTS à
// nombre d'APPELS DE DESSIN CONSTANT**, en changeant la taille du rendu.
//
//   · si le temps par image suit la surface → le banc voit le remplissage ;
//   · s'il reste plat de 0,26 à 9,2 mégapixels → il est limité par la
//     soumission, et **un correctif purement fragmentaire y est invisible par
//     construction**.
//
// ⚠️ **LE TÉMOIN DE LA MANIPULATION EST IMPRIMÉ** : `tampon` relit
// `gl.drawingBufferWidth/Height` après le redimensionnement. Sans lui, un
// `setSize` sans effet rendrait un plateau parfaitement plat — et la conclusion
// serait exactement inversée.
//
// EMPLOI
//   npm run dev -- --port 5519 --strictPort
//   node scripts/diag-charge-fragment.mjs --sortie <fichier.json>
//
// ⚠️ **APRÈS UN `npm ci`, CE BANC NE DÉMARRE PAS TOUT SEUL — RÉSERVE I3.**
// `puppeteer-core` n'est PAS dans `package.json` : c'est un outil de
// diagnostic, pas une dépendance produit. **La phrase à rejouer est :**
//     npm i --no-save puppeteer-core@25.8.0
// Les relevés, eux, sont commités sous
// `.superpowers/sdd/2026-08-22-globe-studio/traces-R6/`.

import fs from 'node:fs'
import path from 'node:path'
import { fileURLToPath } from 'node:url'

const RACINE = fileURLToPath(new URL('..', import.meta.url))
const A = process.argv.slice(2)
const opt = (n, d) => { const i = A.indexOf(n); return i >= 0 && A[i + 1] ? A[i + 1] : d }
const PORT = Number(opt('--port', '5519'))
const SORTIE = opt('--sortie', null)
const BLOCS = Number(opt('--blocs', '5'))
const IMAGES = Number(opt('--images', '40'))
const CHAUFFE = Number(opt('--chauffe', '60'))
const FACTEURS = (opt('--facteurs', '0.5,1,2,3')).split(',').map(Number)
const ALTITUDES = (opt('--altitudes', '40000,2000000')).split(',').map(Number)
const LIEU = opt('--lieu', '30.88,-5.59,12')
const ADRESSE = opt('--adresse', 'terre=unique&frontiere=1&seuil=1&globe=continu&socle=quadtree&f3=0&planete=eclairee')

function trouverChrome() {
  const donne = opt('--chrome', process.env.CHROME_PATH)
  if (donne) return donne
  const pistes = [
    'C:/Program Files/Google/Chrome/Application/chrome.exe',
    'C:/Program Files (x86)/Google/Chrome/Application/chrome.exe',
    '/Applications/Google Chrome.app/Contents/MacOS/Google Chrome',
    '/usr/bin/google-chrome', '/usr/bin/chromium',
  ]
  const t = pistes.find((p) => fs.existsSync(p))
  if (!t) { console.error('Chrome introuvable — passe --chrome <chemin>.'); process.exit(2) }
  return t
}
const puppeteer = await (async () => {
  try { return (await import('puppeteer-core')).default } catch {
    console.error('puppeteer-core absent : npm i --no-save puppeteer-core@25.8.0'); process.exit(2)
  }
})()

const nav = await puppeteer.launch({
  executablePath: trouverChrome(), headless: 'new',
  args: ['--headless=new', '--hide-scrollbars', '--mute-audio', '--window-size=1280,800',
    '--use-angle=d3d11', '--enable-gpu', '--ignore-gpu-blocklist', '--disable-dev-shm-usage',
    '--disable-frame-rate-limit', '--disable-gpu-vsync'],
})
const page = await nav.newPage()
await page.setViewport({ width: 1280, height: 800, deviceScaleFactor: 1 })
page.on('pageerror', (e) => console.error('  [page] ' + e.message))

const b64url = (o) => Buffer.from(JSON.stringify(o), 'utf8').toString('base64')
  .replace(/\+/g, '-').replace(/\//g, '_').replace(/=+$/, '')
const [lat, lon, zoom] = LIEU.split(',').map(Number)
const url = `http://localhost:${PORT}/?${ADRESSE}#s=` + b64url({ loc: { lat, lon, zoom } })
console.log('→ ' + url)
await page.goto(url, { waitUntil: 'load', timeout: 90000 })
await page.waitForFunction('window.__exp && window.__exp.globe', { timeout: 90000 })
await new Promise((r) => setTimeout(r, 6000))
await page.keyboard.press('Escape')
await new Promise((r) => setTimeout(r, 12000))

const materiel = await page.evaluate(() => {
  const gl = window.__exp.renderer.getContext()
  const d = gl.getExtension('WEBGL_debug_renderer_info')
  return d ? gl.getParameter(d.UNMASKED_RENDERER_WEBGL) : 'inconnu'
})
console.log('matériel : ' + materiel)

async function poserAltitude(m) {
  await page.evaluate((cible) => {
    const e = window.__exp, cam = e.camera, ct = e.controls
    ct.minDistance = 1e-4; ct.maxDistance = 1e12
    const t = ct.target, dir = cam.position.clone().sub(t).normalize()
    for (let i = 0; i < 40; i++) {
      const a = e.altitudeCadrageM()
      if (!Number.isFinite(a) || a <= 0) break
      const d = cam.position.distanceTo(t), nd = d * (cible / a)
      if (!Number.isFinite(nd) || nd <= 0) break
      cam.position.copy(t).addScaledVector(dir, nd)
      ct.update?.()
      if (Math.abs(e.altitudeCadrageM() - cible) / cible < 0.004) break
    }
  }, m)
  // le quadtree doit finir de charger CE cadrage
  await new Promise((r) => setTimeout(r, 12000))
}

const resultats = []
for (const alt of ALTITUDES) {
  await poserAltitude(alt)
  const r = await page.evaluate(async ({ blocs, images, chauffe, facteurs }) => {
    const e = window.__exp, gl = e.renderer.getContext(), px = new Uint8Array(4)
    e.params.animations = false
    const barre = () => gl.readPixels(0, 0, 1, 1, gl.RGBA, gl.UNSIGNED_BYTE, px)
    const bloc = (n) => {
      barre()
      const t0 = performance.now()
      for (let i = 0; i < n; i++) e.composer.render(0)
      barre()
      return (performance.now() - t0) / n
    }
    const cv = e.renderer.domElement
    const W = cv.width, H = cv.height
    const sortie = []
    for (const f of facteurs) {
      const w = Math.round(W * f), h = Math.round(H * f)
      e.renderer.setSize(w, h, false)
      e.composer.setSize(w, h)
      for (let i = 0; i < chauffe; i++) e.composer.render(0)
      barre()
      e.renderer.info.autoReset = false
      e.renderer.info.reset()
      e.composer.render(0)
      const appels = e.renderer.info.render.calls, tri = e.renderer.info.render.triangles
      e.renderer.info.autoReset = true
      const t = []
      for (let b = 0; b < blocs; b++) t.push(+bloc(images).toFixed(4))
      const tri2 = [...t].sort((a, b) => a - b)
      sortie.push({
        facteur: f, demande: `${w}x${h}`,
        // ⚠️ LE TÉMOIN DE LA MANIPULATION : ce que le contexte a VRAIMENT alloué.
        tampon: `${gl.drawingBufferWidth}x${gl.drawingBufferHeight}`,
        megapixels: +(gl.drawingBufferWidth * gl.drawingBufferHeight / 1e6).toFixed(2),
        appels, triangles: tri, blocs: t,
        med: tri2[tri2.length >> 1],
      })
    }
    e.renderer.setSize(W, H, false); e.composer.setSize(W, H)
    return { largeurDeBase: W, hauteurDeBase: H, altitude: Math.round(e.altitudeCadrageM()), tuiles: e.globe.tiles.size, mesures: sortie }
  }, { blocs: BLOCS, images: IMAGES, chauffe: CHAUFFE, facteurs: FACTEURS })

  resultats.push(r)
  console.log(`\n${r.altitude} m — ${r.tuiles} tuiles`)
  for (const m of r.mesures) {
    console.log(
      `  ×${String(m.facteur).padEnd(4)} tampon=${m.tampon.padEnd(10)} ${String(m.megapixels).padStart(5)} Mpx  ` +
      `appels=${m.appels} tri=${m.triangles}  blocs=[${m.blocs.map((v) => v.toFixed(2)).join(' ')}]  med=${m.med.toFixed(3)} ms/image`)
  }
  const base = r.mesures[0], haut = r.mesures[r.mesures.length - 1]
  console.log(
    `  ➡️ ×${(haut.megapixels / base.megapixels).toFixed(0)} de fragments à appels constants ⇒ ` +
    `×${(haut.med / base.med).toFixed(2)} de temps par image`)
}

if (SORTIE) {
  const f = path.resolve(RACINE, SORTIE)
  fs.mkdirSync(path.dirname(f), { recursive: true })
  fs.writeFileSync(f, JSON.stringify({ url, materiel, quand: new Date().toISOString(), blocs: BLOCS, images: IMAGES, facteurs: FACTEURS, resultats }, null, 2))
  console.log('\n→ ' + f)
}
await nav.close()
