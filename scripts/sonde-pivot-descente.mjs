// SONDE R13 bis — LE PIVOT PENDANT LA DESCENTE, EN SURFACE SANS CROP.
//
// ══════════ LA RÈGLE D'ADRIEN, ET LA QUESTION QU'ELLE POSE ═════════════════
//
// > **Adrien :** *« On utilise le centre de la Terre comme point de rotation,
// > excepté en mode crop. »*
//
// ⚡ **ET LA GÉOMÉTRIE DIT QUE LES DEUX PIVOTS N'EN FONT PEUT-ÊTRE QU'UN.** La
// correction de R13 ne porte que sur l'AZIMUT — une rotation autour d'un axe
// VERTICAL. Or **une rotation autour d'un axe vertical ne connaît pas le `y` du
// pivot** : c'est déjà ce qui rendait « centre au sol » et « centre du volume »
// indiscernables (0,001 px contre 0,000 px, `.banc/R13/cibles.json`).
//
// Si le centre de la Terre est sur la verticale du centre du bloc, alors
// « pivot = centre de la Terre » et « pivot = axe du bloc » sont **le même
// geste**, et la règle d'Adrien serait déjà appliquée partout.
//
// ⛔ **MAIS ÇA NE SE DÉDUIT PAS, ÇA SE MESURE.** Sous `terre=unique` la Terre
// n'est pas rendue par la caméra du bloc : elle l'est par `camGlobe`, posée par
// la similitude de `frontiere-rendu.js`. Rien ne garantit *a priori* que l'axe
// vertical du bloc s'y envoie sur l'axe du centre de la Terre.
//
// La sonde relève donc DEUX repères pendant le même glissé :
//   · le centre du BLOC     — (0,0,0) projeté par `camera`
//   · le centre de la TERRE — (0,0,0) de l'espace globe, projeté par `camGlobe`
// et, à chaque palier, `veilleCrop.pose` — pour prouver qu'on est bien dans le
// régime « surface SANS crop » que la règle vise.
//
// ⛔ **LE PRÉDICAT EST `veilleCrop.pose`, ET AUCUN AUTRE.** `veilleSocle` n'est
// jamais mise à jour sous le mode sphère (mesuré par une tâche voisine) : elle
// resterait fausse pour toujours.
//
//   node scripts/sonde-pivot-descente.mjs --port 5549 --etiquette descente-apres
//   node scripts/sonde-pivot-descente.mjs --port 5549 --etiquette descente-avant --r13-off 1

import fs from 'node:fs'
import path from 'node:path'
import { fileURLToPath } from 'node:url'

const RACINE = path.dirname(path.dirname(fileURLToPath(import.meta.url)))
const ICI = path.join(RACINE, '.banc', 'R13')
fs.mkdirSync(ICI, { recursive: true })
const A = process.argv.slice(2)
const opt = (n, d) => { const i = A.indexOf(n); return i >= 0 && A[i + 1] !== undefined ? A[i + 1] : d }
const PORT = Number(opt('--port', '5549'))
const ETIQ = opt('--etiquette', 'descente')
const DX = Number(opt('--dx', '100'))
const REPOS = Number(opt('--images-repos', '150'))
const OFF = opt('--r13-off', '0') !== '0'
const W = 1280, H = 800

const pup = (await import('file:///C:/Dev/wt-f3/node_modules/puppeteer-core/lib/puppeteer/puppeteer-core.js')).default
const nav = await pup.launch({
  executablePath: 'C:/Program Files/Google/Chrome/Application/chrome.exe',
  headless: 'new', args: [`--window-size=${W},${H + 120}`, '--use-angle=default'],
  defaultViewport: { width: W, height: H },
})
const page = (await nav.pages())[0]
const cdp = await page.target().createCDPSession()
const wait = (n) => page.evaluate((k) => new Promise((r) => { let i = 0; const t = () => (++i >= k ? r() : requestAnimationFrame(t)); requestAnimationFrame(t) }), n)

// ── l'état lu dans la page : les DEUX repères, et le prédicat de crop ───────
const ETAT = [
  '(() => {',
  '  const e = window.__exp, c = e.controls, cam = e.camera',
  '  const r = e.renderer.domElement.getBoundingClientRect()',
  '  const proj = (camera, x, y, z) => {',
  '    const V = new (cam.position.constructor)(x, y, z); V.project(camera)',
  '    return { x: (V.x * 0.5 + 0.5) * r.width, y: (-V.y * 0.5 + 0.5) * r.height }',
  '  }',
  '  return {',
  '    mode: e.modes.mode, busy: !!e.modes.busy, altM: e.modes.altM,',
  '    cropPose: !!(e.veilleCrop && e.veilleCrop.pose),',
  '    cropRepos: !!(e.veilleCrop && e.veilleCrop.repos),',
  '    centreBloc: proj(cam, 0, 0, 0),',
  '    centreTerre: e.camGlobe ? proj(e.camGlobe, 0, 0, 0) : null,',
  '    target: { x: c.target.x, y: c.target.y, z: c.target.z },',
  '    cam: { x: cam.position.x, y: cam.position.y, z: cam.position.z },',
  '    dist: cam.position.distanceTo(c.target),',
  '    azimut: c.getAzimuthalAngle(), polaire: c.getPolarAngle(),',
  '    rotateSpeed: c.rotateSpeed, canevas: [r.width, r.height],',
  '  }',
  '})()',
].join('\n')

const R2D = 180 / Math.PI
const dpx = (a, b) => (a && b ? Math.hypot(a.x - b.x, a.y - b.y) : null)

await page.goto(`http://localhost:${PORT}/`, { waitUntil: 'domcontentloaded', timeout: 60000 })
await page.waitForFunction('!!(window.__exp && window.__exp.controls)', { timeout: 60000 })
await page.waitForFunction("!!document.getElementById('loading')?.classList.contains('hidden')", { timeout: 90000 })
if (OFF) await page.evaluate(() => { window.__R13_OFF = true })
await wait(200)

const CX = W / 2, CY = H / 2
const m = (t, x, y, b = 'left', bs = 1) => cdp.send('Input.dispatchMouseEvent', { type: t, x, y, button: b, buttons: bs, clickCount: t === 'mousePressed' ? 1 : 0 })
const lire = () => page.evaluate(ETAT)
const journal = { etiquette: ETIQ, r13Off: OFF, dx: DX, paliers: [] }

// ⚠️ ÉCHAUFFEMENT — le premier pointerdown d'une session n'atteint pas OrbitControls
await m('mouseMoved', CX, CY, 'none', 0); await m('mousePressed', CX, CY); await wait(3)
await m('mouseMoved', CX + 20, CY); await wait(40); await m('mouseReleased', CX + 20, CY, 'left', 0); await wait(120)

// ⚡ ET ON DÉCENTRE LA CIBLE — sans ça les deux pivots coïncident et la mesure
// ne dit rien. Le clic droit fait glisser la fenêtre de terrain : c'est le geste réel.
await cdp.send('Input.dispatchMouseEvent', { type: 'mousePressed', x: CX, y: CY, button: 'right', buttons: 2, clickCount: 1 })
await wait(3)
for (let i = 1; i <= 12; i++) { await cdp.send('Input.dispatchMouseEvent', { type: 'mouseMoved', x: CX - 14 * i, y: CY - 8 * i, button: 'right', buttons: 2 }); await wait(2) }
await cdp.send('Input.dispatchMouseEvent', { type: 'mouseReleased', x: CX - 168, y: CY - 96, button: 'right', buttons: 0 })
await wait(220)

async function glisser() {
  await m('mouseMoved', CX, CY, 'none', 0); await wait(1)
  await m('mousePressed', CX, CY); await wait(3)     // bouton TENU : spin gelé
  const avant = await lire()
  for (let i = 1; i <= 10; i++) { await m('mouseMoved', CX + (DX * i) / 10, CY); await wait(1) }
  await wait(REPOS)
  const apres = await lire()
  await m('mouseReleased', CX + DX, CY, 'left', 0); await wait(6)
  return { avant, apres }
}

async function palier(nom) {
  const { avant, apres } = await glisser()
  const r = {
    nom, mode: avant.mode, altM: avant.altM, cropPose: avant.cropPose,
    rotateSpeed: avant.rotateSpeed, canevas: avant.canevas,
    dAzimutDeg: Math.abs(apres.azimut - avant.azimut) * R2D,
    deriveCentreBlocPx: dpx(avant.centreBloc, apres.centreBloc),
    deriveCentreTerrePx: dpx(avant.centreTerre, apres.centreTerre),
    dLnDistance: Math.abs(Math.log(Math.max(apres.dist, 1e-12) / Math.max(avant.dist, 1e-12))),
    ecartCibleAxe: Math.hypot(avant.target.x, avant.target.z),
    avant, apres,
  }
  journal.paliers.push(r)
  const f = (x) => (x == null ? '—' : Number(x).toPrecision(6))
  console.log(
    `${nom.padEnd(24)} ${r.mode.padEnd(8)} ${String(Math.round(r.altM)).padStart(10)} m  crop ${r.cropPose ? 'OUI' : 'non'}  ` +
    `dAzim ${f(r.dAzimutDeg).padEnd(10)} bloc ${f(r.deriveCentreBlocPx).padEnd(12)} TERRE ${f(r.deriveCentreTerrePx).padEnd(12)} |Δln d| ${f(r.dLnDistance)}`
  )
  return r
}

console.log(`\n=== R13 bis — pivot pendant la descente ${OFF ? '(TÉMOIN : correction éteinte)' : '(correction active)'} ===`)
console.log('palier                   mode       altitude   crop      dAzimut       dérive CENTRE BLOC  dérive CENTRE TERRE  |Δln d|')

// ① sur le bloc, crop posé — l'exception que la règle nomme
await palier('1-bloc (crop pose)')

// ⚠️ **LE RÉGIME « SURFACE SANS CROP » NE S'ATTEINT PAS EN DÉZOOMANT, ET
// C'EST MESURÉ.** Depuis l'ouverture, `cranZoom(-1)` bute à `maxDistance = 150`
// (18 762 m) et n'y franchit plus rien : le budget de niveau avance de
// `log(nouvelle/dist)`, or à la butée les deux sont égales, donc le budget vaut 0
// et `_franchirSiBesoin` ne franchit jamais. **25 crans, altitude inchangée.**
//
// ➡️ Le seul chemin est donc celui d'Adrien : **DESCENDRE depuis l'orbite**,
// puis reculer de quelques crans pour repasser au-dessus des 32,3 km où le crop
// meurt. C'est aussi le geste réel — personne n'arrive sur le bloc autrement.
await page.evaluate(() => window.__exp.modes.enterOrbit(60000000))
await page.waitForFunction("window.__exp.modes.mode === 'orbital' && !window.__exp.modes.busy", { timeout: 60000 })
await wait(90)
await palier('2-orbite 60 000 km')

// la traversée, par la porte géométrique du mode continu (`_diveArmed`)
await page.evaluate(() => { const m = window.__exp.modes; m.orbAlt = m.orbAltTarget = 40000 / 63710; m._diveArmed = true })
await page.waitForFunction("window.__exp.modes.mode === 'surface'", { timeout: 60000 })
await page.waitForFunction('!window.__exp.modes.busy', { timeout: 60000 })
await wait(120)

// → reculer jusqu'à ce que le crop MEURE : c'est là que vit la règle d'Adrien
let recule = 0
for (; recule < 30; recule++) {
  const c = await page.evaluate('!!(window.__exp.veilleCrop && window.__exp.veilleCrop.pose)')
  if (!c) break
  await page.evaluate(() => window.__exp.modes.cranZoom(-1))
  await wait(25)
  await page.waitForFunction('!window.__exp.modes.busy', { timeout: 30000 }).catch(() => {})
  await wait(25)
}
journal.cransPourTuerLeCrop = recule
await wait(150)
const e3 = await lire()
if (e3.cropPose) {
  console.log(`   ⛔ le crop ne meurt pas après ${recule} crans (alt ${Math.round(e3.altM)} m) — palier 3 impossible`)
  journal.paliers.push({ nom: '3-descente SANS crop', saute: 'crop toujours posé', altM: e3.altM, crans: recule })
} else {
  await palier('3-descente SANS crop')
}

// → puis redescendre : le crop renaît, et on remesure de l'autre côté du seuil
for (let i = 0; i < 30; i++) {
  const c = await page.evaluate('!!(window.__exp.veilleCrop && window.__exp.veilleCrop.pose)')
  if (c) break
  await page.evaluate(() => window.__exp.modes.cranZoom(1))
  await wait(25)
  await page.waitForFunction('!window.__exp.modes.busy', { timeout: 30000 }).catch(() => {})
  await wait(25)
}
await wait(150)
await palier('4-retour AVEC crop')

fs.writeFileSync(path.join(ICI, `${ETIQ}.json`), JSON.stringify(journal, null, 1), 'utf8')
await nav.close()
console.log(`\n→ .banc/R13/${ETIQ}.json`)
