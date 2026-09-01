// SONDE R27 — LE PIVOT PENDANT UNE DESCENTE COMPLÈTE, ET LE RETOUR DU CROP.
//
// ══════════ CE QU'ELLE RELÈVE, ET POURQUOI DANS LA BOUCLE ══════════════════
//
// ⛔ **UNE SONDE POSÉE APRÈS LA FONCTION LIT UN ÉTAT DÉJÀ ÉCRASÉ** — R23 a relevé
// six fois la même butée de 59,330° qui était sa pose d'ouverture. On enveloppe
// donc `controls.update` : chaque image est relevée là où la loi vient de
// s'appliquer, avant que quoi que ce soit d'autre ne repose la caméra.
//
// Par image : mode, `busy`, altitude de cadrage, `veilleCrop.pose`, l'existence
// de `globe._crop`, `controls.target`, la caméra, la distance, l'inclinaison au
// NADIR LOCAL (⚠️ pas la latitude — R23 s'y est fait prendre), et la projection
// à l'écran de trois repères (centre du bloc, sujet au sol, centre de la Terre
// par `camGlobe`).
//
//   node scripts/sonde-pivot-r27.mjs --port 5837 --etiquette apres
//
import fs from 'node:fs'
import path from 'node:path'
import { fileURLToPath } from 'node:url'

const RACINE = path.dirname(path.dirname(fileURLToPath(import.meta.url)))
const ICI = path.join(RACINE, '.banc', 'R27')
fs.mkdirSync(ICI, { recursive: true })
const A = process.argv.slice(2)
const opt = (n, d) => { const i = A.indexOf(n); return i >= 0 && A[i + 1] !== undefined ? A[i + 1] : d }
const PORT = Number(opt('--port', '5837'))
const ETIQ = opt('--etiquette', 'apres')
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

await page.goto(`http://localhost:${PORT}/`, { waitUntil: 'domcontentloaded', timeout: 90000 })
await page.waitForFunction('!!(window.__exp && window.__exp.controls)', { timeout: 90000 })
await page.waitForFunction("!!document.getElementById('loading')?.classList.contains('hidden')", { timeout: 120000 })
// ⚠️ LE VOILE D'ACCUEIL MANGE TOUS LES GESTES (rétractation R23) — on le ferme.
await page.keyboard.press('Escape').catch(() => {})
await page.evaluate(() => { document.querySelectorAll('.ce-hubveil').forEach((e) => e.remove()) })
await wait(60)

// ══════════ L'ENREGISTREUR, DANS LA BOUCLE ════════════════════════════════
await page.evaluate(() => {
  const e = window.__exp
  const c = e.controls, cam = e.camera
  const T = cam.position.constructor
  window.__R27 = { on: false, tag: '', frames: [] }
  const proj = (camera, x, y, z) => {
    const V = new T(x, y, z); V.project(camera)
    const r = e.renderer.domElement.getBoundingClientRect()
    return [(V.x * 0.5 + 0.5) * r.width, (-V.y * 0.5 + 0.5) * r.height]
  }
  // ⚠️ L'INCLINAISON EST PRISE AU NADIR **LOCAL**, PAS CONTRE L'AXE y DU MONDE.
  // En orbite la verticale locale est le RAYON : mesurer contre `y` rendrait la
  // LATITUDE du point survolé (R23 a publié 21,26° en croyant lire 0,00006°).
  const inclinaisonDeg = () => {
    const v = new T().copy(cam.position).sub(c.target)
    if (!(v.lengthSq() > 0)) return 0
    v.normalize()
    let up
    if (e.modes.mode === 'orbital') {
      up = new T().copy(cam.position).normalize() // le rayon = la verticale locale
    } else {
      up = new T(0, 1, 0) // sur la dalle, la verticale du monde EST la verticale locale
    }
    return Math.acos(Math.max(-1, Math.min(1, v.dot(up)))) * 180 / Math.PI
  }
  const orig = c.update.bind(c)
  c.update = (...a) => {
    const r = orig(...a)
    const R = window.__R27
    if (R.on) {
      const g = e.globe
      R.frames.push({
        t: R.frames.length, tag: R.tag,
        mode: e.modes.mode, busy: !!e.modes.busy, fondu: !!e.modes._fonduPose,
        altM: e.altitudeCadrageM(), altModeM: e.modes.altM,
        crop: !!(g && g._crop), cropPose: !!(e.veilleCrop && e.veilleCrop.pose),
        cropRepos: !!(e.veilleCrop && e.veilleCrop.repos),
        tx: c.target.x, ty: c.target.y, tz: c.target.z,
        cx: cam.position.x, cy: cam.position.y, cz: cam.position.z,
        d: cam.position.distanceTo(c.target),
        phi: c.getPolarAngle(), az: c.getAzimuthalAngle(),
        incl: inclinaisonDeg(),
        pBloc: proj(cam, 0, 0, 0),
        pSujet: proj(cam, 14, 0, 14),
        pTerre: e.camGlobe ? proj(e.camGlobe, 0, 0, 0) : null,
        zoom: e.params?.demZoom ?? null,
        repos: !!(e.veilleRepos && e.veilleRepos.auRepos),
        basculesRepos: e.veilleRepos ? e.veilleRepos.bascules : null,
        ecartRepos: e.veilleRepos ? e.veilleRepos.dernierEcart : null,
      })
    }
    return r
  }
})

const on = (tag) => page.evaluate((t) => { window.__R27.on = true; window.__R27.tag = t }, tag)
const off = () => page.evaluate(() => { window.__R27.on = false })
const tag = (t) => page.evaluate((x) => { window.__R27.tag = x }, t)
const etat = () => page.evaluate(() => {
  const e = window.__exp, c = e.controls
  return {
    mode: e.modes.mode, busy: !!e.modes.busy, altM: e.altitudeCadrageM(), altModeM: e.modes.altM,
    crop: !!(e.globe && e.globe._crop), cropPose: !!(e.veilleCrop && e.veilleCrop.pose),
    target: { x: c.target.x, y: c.target.y, z: c.target.z },
    d: e.camera.position.distanceTo(c.target), zoom: e.params?.demZoom ?? null,
    basculesRepos: e.veilleRepos ? e.veilleRepos.bascules : null,
  }
})

// ── ① MONTER EN ORBITE HAUTE ────────────────────────────────────────────────
await page.evaluate(() => window.__exp.modes.enterOrbit(60000000))
await page.waitForFunction("window.__exp.modes.mode === 'orbital' && !window.__exp.modes.busy", { timeout: 90000 })
await wait(90)

// ── ② LA DESCENTE COMPLÈTE, AU CRAN, JUSQU'AU BLOC ─────────────────────────
await on('descente')
for (let i = 0; i < 120; i++) {
  await page.evaluate(() => { const m = window.__exp.modes; m._diveArmed = true; m.cranZoom(1) })
  await wait(8)
  const s = await page.evaluate(() => ({ m: window.__exp.modes.mode, b: !!window.__exp.modes.busy, c: !!(window.__exp.globe && window.__exp.globe._crop), z: window.__exp.params?.demZoom }))
  if (s.b) { await page.waitForFunction('!window.__exp.modes.busy', { timeout: 90000 }).catch(() => {}); await wait(20) }
  if (s.m === 'surface' && s.c && s.z >= 11) break
}
await wait(120) // laisser le repos se poser (IMAGES_CALME = 30)
await tag('pose-bloc')
await wait(60)
const surLeBloc = await etat()

// ── ③ ON DÉCENTRE LA CIBLE SUR LE CROP, comme le ferait un déplacement de vue.
//     ⚠️ **DÉPLACEMENT RIGIDE** — caméra ET cible du même vecteur : la pose de
//     départ du retour a donc exactement la distance qu'elle avait, et ce que
//     la sonde relèvera ensuite ne contient rien de ce décalage-ci.
await tag('decentrage')
await page.evaluate(() => {
  const e = window.__exp, c = e.controls, cam = e.camera
  const dx = 9.5, dz = -7.4
  c.target.x += dx; c.target.z += dz
  cam.position.x += dx; cam.position.z += dz
  cam.lookAt(c.target)
})
await wait(40)
const decentre = await etat()

// ── ④ LE RETOUR ISOLÉ : on dézoome JUSTE assez pour tuer le crop, puis PLUS
//     UN GESTE. C'est le seul protocole où le recentrage est seul à l'écran :
//     avec des crans qui continuent, `|Δ ln d|` est dominé par le zoom voulu.
await tag('retour')
for (let i = 0; i < 60; i++) {
  const c = await page.evaluate(() => !!(window.__exp.globe && window.__exp.globe._crop))
  if (!c) break
  await page.evaluate(() => window.__exp.modes.cranZoom(-1))
  await wait(8)
  const b = await page.evaluate(() => !!window.__exp.modes.busy)
  if (b) { await page.waitForFunction('!window.__exp.modes.busy', { timeout: 90000 }).catch(() => {}); await wait(20) }
}
await tag('retour-libre') // plus aucun geste : on regarde la caméra revenir seule
await wait(420)
const apresRetour = await etat()

// ── ④ bis LE RECENTRAGE SEUL — le balayage de D16 ter est fini, plus rien
//     d'autre ne touche la caméra. C'est le seul protocole où `|Δ ln d|` ne
//     contient QUE le recentrage. On décale de nouveau, RIGIDEMENT.
await tag('injection')
await page.evaluate(() => {
  const e = window.__exp, c = e.controls, cam = e.camera
  const dx = -11.2, dz = 6.9
  c.target.x += dx; c.target.z += dz
  cam.position.x += dx; cam.position.z += dz
  cam.lookAt(c.target)
})
await wait(3)
await tag('recentrage-seul')
await wait(320)
const apresSeul = await etat()

// ── ④ ET ON CONTINUE JUSQU'À L'ORBITE ──────────────────────────────────────
await tag('remontee')
for (let i = 0; i < 120; i++) {
  await page.evaluate(() => window.__exp.modes.cranZoom(-1))
  await wait(8)
  const s = await page.evaluate(() => ({ m: window.__exp.modes.mode, b: !!window.__exp.modes.busy }))
  if (s.b) { await page.waitForFunction('!window.__exp.modes.busy', { timeout: 90000 }).catch(() => {}); await wait(20) }
  if (s.m === 'orbital') break
}
await wait(90)
await off()
const enOrbite = await etat()

const frames = await page.evaluate(() => window.__R27.frames)
fs.writeFileSync(path.join(ICI, `${ETIQ}.json`), JSON.stringify({ etiquette: ETIQ, surLeBloc, decentre, apresRetour, apresSeul, enOrbite, frames }, null, 0), 'utf8')

// ══════════ DÉPOUILLEMENT ═════════════════════════════════════════════════
const f6 = (x) => (x == null ? '—' : Number(x).toPrecision(6))
console.log(`\n=== R27 — ${ETIQ} · ${frames.length} images relevées DANS la boucle ===\n`)

// jalons : une image par décade d'altitude sur la descente
const desc = frames.filter((f) => f.tag === 'descente')
const rem = frames.filter((f) => f.tag === 'remontee')
console.log('LA DESCENTE — jalons')
console.log('  #     altitude(m)      mode     zoom  crop  target(x,y,z)                        |t|      dist')
const vus = new Set()
for (const f of desc) {
  const k = `${f.mode}|${f.crop}|${Math.floor(Math.log10(Math.max(f.altM, 1)) * 3)}`
  if (vus.has(k)) continue
  vus.add(k)
  console.log(`  ${String(f.t).padStart(5)} ${String(Math.round(f.altM)).padStart(13)} ${f.mode.padEnd(9)} ${String(f.zoom ?? '—').padStart(4)}  ${f.crop ? 'OUI ' : 'non '} (${f.tx.toFixed(4)}, ${f.ty.toFixed(4)}, ${f.tz.toFixed(4)})`.padEnd(96) + ` ${Math.hypot(f.tx, f.ty, f.tz).toFixed(5).padStart(9)} ${f.d.toFixed(3).padStart(9)}`)
}

const horsOrigine = (f) => Math.hypot(f.tx, f.ty, f.tz)
const pireHorsCrop = frames.filter((f) => !f.crop).reduce((a, f) => (horsOrigine(f) > horsOrigine(a) ? f : a), frames[0])
console.log(`\n  pire écart de \`target\` à l'origine HORS CROP : ${f6(horsOrigine(pireHorsCrop))} u  (image ${pireHorsCrop.t}, mode ${pireHorsCrop.mode}, alt ${Math.round(pireHorsCrop.altM)} m)`)

// veille-repos : |Δ ln d| image à image, dans le mode surface
let pireLn = { v: 0 }
for (let i = 1; i < frames.length; i++) {
  const a = frames[i - 1], b = frames[i]
  if (a.tag !== b.tag) continue
  if (!(a.d > 0 && b.d > 0)) continue
  const v = Math.abs(Math.log(b.d / a.d))
  if (v > pireLn.v) pireLn = { v, i, a, b }
}
console.log(`\n|Δ ln d| MAXIMAL image→image, toutes images : ${f6(pireLn.v)}  (seuil veille-repos 1e-4)`)
if (pireLn.a) console.log(`    image ${pireLn.a.t} → ${pireLn.b.t} · ${pireLn.a.mode}→${pireLn.b.mode} · crop ${pireLn.a.crop}→${pireLn.b.crop} · busy ${pireLn.a.busy}/${pireLn.b.busy} · d ${f6(pireLn.a.d)} → ${f6(pireLn.b.d)}`)

// hors des images où la machine pose elle-même (busy) et hors changement de mode
let pireLnCalme = { v: 0 }
for (let i = 1; i < frames.length; i++) {
  const a = frames[i - 1], b = frames[i]
  if (a.tag !== b.tag || a.mode !== b.mode || a.busy || b.busy) continue
  if (!(a.d > 0 && b.d > 0)) continue
  const v = Math.abs(Math.log(b.d / a.d))
  if (v > pireLnCalme.v) pireLnCalme = { v, a, b }
}
console.log(`|Δ ln d| MAXIMAL hors \`busy\` et à mode constant : ${f6(pireLnCalme.v)}`)
if (pireLnCalme.a) console.log(`    image ${pireLnCalme.a.t} → ${pireLnCalme.b.t} · crop ${pireLnCalme.a.crop}→${pireLnCalme.b.crop} · d ${f6(pireLnCalme.a.d)} → ${f6(pireLnCalme.b.d)}`)

// LA BASCULE DU CROP — les images qui l'encadrent, et le saut à l'écran
function bascules(list, champ) {
  const out = []
  for (let i = 1; i < list.length; i++) if (list[i][champ] !== list[i - 1][champ]) out.push(i)
  return out
}
for (const [nom, list] of [['DESCENTE', desc], ['REMONTÉE', rem]]) {
  const b = bascules(list, 'crop')
  console.log(`\n${nom} — bascules de \`globe._crop\` : ${b.length}`)
  for (const i of b) {
    const a = list[i - 1], c = list[i]
    const dpx = (p, q) => (p && q ? Math.hypot(p[0] - q[0], p[1] - q[1]) : null)
    console.log(`   image ${a.t}→${c.t} · ${a.crop ? 'crop→nu' : 'nu→crop'} · alt ${Math.round(a.altM)}→${Math.round(c.altM)} m`)
    console.log(`      target (${a.tx.toFixed(4)},${a.ty.toFixed(4)},${a.tz.toFixed(4)}) → (${c.tx.toFixed(4)},${c.ty.toFixed(4)},${c.tz.toFixed(4)})`)
    console.log(`      |Δ ln d| ${f6(Math.abs(Math.log(c.d / a.d)))} · centre bloc à l'écran ${f6(dpx(a.pBloc, c.pBloc))} px · sujet ${f6(dpx(a.pSujet, c.pSujet))} px · TERRE ${f6(dpx(a.pTerre, c.pTerre))} px`)
  }
}

// ══════ LE RETOUR DEPUIS LE CROP, SEUL À L'ÉCRAN ═══════════════════════════
const retour = frames.filter((f) => f.tag === 'retour' || f.tag === 'retour-libre')
const mortCrop = retour.findIndex((f) => !f.crop)
if (mortCrop >= 0) {
  const suite = retour.slice(mortCrop)
  const libre = suite.filter((f) => f.tag === 'retour-libre' && !f.busy)
  const rxz = (f) => Math.hypot(f.tx, f.tz)
  const iFini = libre.findIndex((f) => rxz(f) === 0)
  let pLn = 0, pPx = 0, pLnI = null, pPxI = null
  for (let i = 1; i < libre.length; i++) {
    const a = libre[i - 1], b = libre[i]
    const v = Math.abs(Math.log(b.d / a.d))
    if (v > pLn) { pLn = v; pLnI = a.t }
    const p = Math.hypot(a.pBloc[0] - b.pBloc[0], a.pBloc[1] - b.pBloc[1])
    if (p > pPx) { pPx = p; pPxI = a.t }
  }
  console.log('\nLE RETOUR DEPUIS LE CROP — aucun geste après la mort du crop')
  console.log(`  écart de la cible à l'axe à la mort du crop : ${f6(rxz(suite[0]))} u  (alt ${Math.round(suite[0].altM)} m)`)
  console.log(`  images sans geste relevées : ${libre.length}`)
  console.log(`  images pour revenir EXACTEMENT sur l'axe : ${iFini >= 0 ? iFini + 1 : 'PAS ATTEINT'}`)
  console.log(`  écart final : ${f6(rxz(libre[libre.length - 1] ?? suite[0]))} u`)
  console.log(`  |Δ ln d| MAXIMAL sur le retour : ${f6(pLn)}  (seuil 1e-4)  [image ${pLnI}]`)
  console.log(`  SAUT MAXIMAL du centre du bloc à l'écran : ${f6(pPx)} px  [image ${pPxI}]`)
  // ⚠️ **ET LA PART DU RECENTRAGE LÀ-DEDANS, ISOLÉE.** Le déplacement de la
  // CIBLE d'une image à l'autre EST le pas de recentrage (rien d'autre ne
  // l'écrit ici) ; son équivalent en pixels vaut `|δ| / d × 1350`.
  let pDelta = 0, pDeltaPx = 0
  for (let i = 1; i < libre.length; i++) {
    const a = libre[i - 1], b = libre[i]
    const dd = Math.hypot(b.tx - a.tx, b.tz - a.tz)
    if (dd > pDelta) pDelta = dd
    const px = (dd / b.d) * ((800 / 2) / Math.tan((33 / 2) * Math.PI / 180))
    if (px > pDeltaPx) pDeltaPx = px
  }
  console.log(`  pas de RECENTRAGE maximal : ${f6(pDelta)} u, soit ${f6(pDeltaPx)} px (plafond de la loi : 4,05 px)`)
  // ⚡ **LE RECENTRAGE SEUL, SANS LE BALAYAGE DE D16 ter.** Les deux courent en
  // même temps ; le balayage, lui, change la distance par construction (il
  // tourne l'élévation à `camY` constant). On isole donc les images où le
  // recentrage bouge la cible ET où AUCUN balayage ne tourne.
  let nSeul = 0, pLnSeul = 0, pPxSeul = 0
  for (let i = 1; i < libre.length; i++) {
    const a = libre[i - 1], b = libre[i]
    if (a.fondu || b.fondu) continue
    if (Math.hypot(b.tx - a.tx, b.tz - a.tz) === 0) continue
    nSeul++
    pLnSeul = Math.max(pLnSeul, Math.abs(Math.log(b.d / a.d)))
    pPxSeul = Math.max(pPxSeul, Math.hypot(a.pBloc[0] - b.pBloc[0], a.pBloc[1] - b.pBloc[1]))
  }
  console.log(`  → images où le recentrage est SEUL à bouger la caméra : ${nSeul}`)
  console.log(`    |Δ ln d| MAXIMAL sur ces images : ${f6(pLnSeul)}  (seuil 1e-4)`)
  console.log(`    saut MAXIMAL du centre du bloc sur ces images : ${f6(pPxSeul)} px`)
  const inclLibre = libre.map((f) => f.incl)
  console.log(`  inclinaison sur le retour : ${f6(inclLibre[0])}° → ${f6(inclLibre[inclLibre.length - 1])}° · pas MAX par image ${f6(Math.max(...inclLibre.slice(1).map((v, i) => Math.abs(v - inclLibre[i]))))}°`)
}

// ══════ LE RECENTRAGE SEUL À L'ÉCRAN ══════════════════════════════════════
const seul = frames.filter((f) => f.tag === 'recentrage-seul' && !f.busy)
if (seul.length > 1) {
  const rxz = (f) => Math.hypot(f.tx, f.tz)
  let pLn = 0, pPx = 0, pSujet = 0, n = 0, fondus = 0
  for (let i = 1; i < seul.length; i++) {
    const a = seul[i - 1], b = seul[i]
    if (a.fondu || b.fondu) { fondus++; continue }
    if (Math.hypot(b.tx - a.tx, b.tz - a.tz) === 0) continue
    n++
    pLn = Math.max(pLn, Math.abs(Math.log(b.d / a.d)))
    pPx = Math.max(pPx, Math.hypot(a.pBloc[0] - b.pBloc[0], a.pBloc[1] - b.pBloc[1]))
    pSujet = Math.max(pSujet, Math.hypot(a.pSujet[0] - b.pSujet[0], a.pSujet[1] - b.pSujet[1]))
  }
  const iFini = seul.findIndex((f) => rxz(f) === 0)
  console.log('\nLE RECENTRAGE SEUL À L’ÉCRAN — décalage rigide injecté, plus aucun geste')
  console.log(`  écart injecté : ${f6(rxz(seul[0]))} u · images pour revenir sur l’axe : ${iFini >= 0 ? iFini + 1 : 'PAS ATTEINT'} · écart final ${f6(rxz(seul[seul.length - 1]))} u`)
  console.log(`  images où le recentrage BOUGE la caméra, seul : ${n}  (images écartées parce qu’un balayage tournait : ${fondus})`)
  console.log(`  |Δ ln d| MAXIMAL sur ces images : ${f6(pLn)}  ⟵ contre le seuil 1e-4`)
  console.log(`  saut MAXIMAL du centre du bloc : ${f6(pPx)} px · du sujet au sol : ${f6(pSujet)} px`)
  console.log(`  bascules de veille-repos sur la période : ${seul[seul.length - 1].basculesRepos - seul[0].basculesRepos}`)
  console.log(`  |Δ ln d| que veille-repos a RÉELLEMENT relevé, maximum : ${f6(Math.max(...seul.map((f) => f.ecartRepos ?? 0)))}`)
}

// ══════ LA PORTE ORBITALE — L'ALTITUDE OÙ ELLE S'OUVRE ═════════════════════
const iOrb = frames.findIndex((f, i) => i > 0 && f.mode === 'orbital' && frames[i - 1].mode === 'surface')
if (iOrb > 0) {
  // ⛔ **PAS `frames[iOrb - 1]`.** `enterOrbit` repose la caméra sur la sphère À
  // L'INTÉRIEUR de son rideau et n'écrit `this.mode = 'orbital'` qu'à la
  // dernière ligne : l'image d'avant porte donc `mode: 'surface'` avec une pose
  // DÉJÀ orbitale (d = 223 contre un plafond de surface de 150, et une altitude
  // de cadrage NÉGATIVE — le résidu que `veille-socle.js` décrit). La dernière
  // vraie image de surface est la dernière AVANT `busy`.
  let j = iOrb - 1
  while (j > 0 && (frames[j].busy || frames[j].mode !== 'surface')) j--
  const a = frames[j]
  console.log(`\nLA PORTE ORBITALE — dernière image de surface HORS rideau (image ${a.t}) : z${a.zoom} · altitude de cadrage ${Math.round(a.altM)} m · altitude machine ${Math.round(a.altModeM)} m · d ${f6(a.d)}`)
  const b = frames[iOrb - 1]
  console.log(`   (image ${b.t}, encore marquée surface, DÉJÀ la pose orbitale : d ${f6(b.d)} · cadrage ${Math.round(b.altM)} m — un résidu, pas une altitude)`)
}

// D16 ter — l'inclinaison en ORBITE doit rester au nadir
const orb = frames.filter((f) => f.mode === 'orbital' && !f.busy)
const inclOrb = orb.reduce((m, f) => Math.max(m, f.incl), 0)
console.log(`\nD16 ter — inclinaison MAXIMALE en orbite (${orb.length} images) : ${f6(inclOrb)}°`)
const surf = frames.filter((f) => f.mode === 'surface' && !f.busy)
const inclSurfSansCrop = surf.filter((f) => !f.crop).reduce((m, f) => Math.max(m, f.incl), 0)
const inclSurfCrop = surf.filter((f) => f.crop).reduce((m, f) => Math.max(m, f.incl), 0)
console.log(`          inclinaison MAX en surface SANS crop : ${f6(inclSurfSansCrop)}°  ·  AVEC crop : ${f6(inclSurfCrop)}°`)

console.log(`\nsur le bloc : ${JSON.stringify(surLeBloc)}`)
console.log(`en orbite   : ${JSON.stringify(enOrbite)}`)
console.log(`\n→ .banc/R27/${ETIQ}.json`)
await nav.close()
