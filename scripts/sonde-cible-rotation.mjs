// SONDE R13 / ÉTAPE 3 — AUTOUR DE QUOI TOURNE-T-ON SUR LE BLOC ?
//
// ══════════ LA QUESTION, ET POURQUOI ELLE SE MESURE ════════════════════════
//
// En orbite, `controls.target = (0, 0, 0)` : le CENTRE de l'objet qu'on regarde.
// La Terre reste donc plantée au milieu du cadre quoi qu'on fasse — c'est ce
// qui donne au geste sa sensation de « tourner autour d'elle ».
//
// Sur le bloc, la cible est un POINT AU SOL (`target.y = -0,3`), décentré de
// l'aplomb du bloc dès qu'on a glissé. Tourner autour de lui n'est PAS tourner
// autour du bloc : le bloc dérive dans le cadre.
//
// ⚡ **CE N'EST PAS UN CHOIX D'ALGORITHME, C'EST UN CHOIX DE SENSATION.** La
// sonde ne tranche donc pas : elle CHIFFRE les trois candidats sur la seule
// grandeur que l'œil juge — **de combien le bloc bouge à l'écran, en pixels,
// pendant un glissé de N pixels.**
//
//   · `visee`   — `controls.target`, la cible d'AUJOURD'HUI (un point au sol) ;
//   · `sol`     — l'aplomb du CENTRE du bloc, au niveau du sol (0, 0, 0) ;
//   · `volume`  — le centre du VOLUME du bloc, socle compris (0, −depth/2, 0) ;
//   · `curseur` — le point du relief sous le curseur (`hooks.pointUnder`).
//
// Pour chacun : le déplacement à l'écran du centre du bloc, celui de ses quatre
// coins, et l'angle dont la visée a tourné.
//
// EMPLOI
//   node scripts/sonde-cible-rotation.mjs --port 5549 --etiquette cibles

import fs from 'node:fs'
import path from 'node:path'
import { fileURLToPath } from 'node:url'

const RACINE = path.dirname(path.dirname(fileURLToPath(import.meta.url)))
const ICI = path.join(RACINE, '.banc', 'R13')
fs.mkdirSync(ICI, { recursive: true })

const A = process.argv.slice(2)
const opt = (n, d) => { const i = A.indexOf(n); return i >= 0 && A[i + 1] !== undefined ? A[i + 1] : d }
const PORT = Number(opt('--port', '5549'))
const ETIQ = opt('--etiquette', 'cibles')
const DX = Number(opt('--dx', '100'))
const REPOS = Number(opt('--images-repos', '150'))
const LARGEUR = Number(opt('--largeur', '1280'))
const HAUTEUR = Number(opt('--hauteur', '800'))
const VISIBLE = opt('--visible', '0') !== '0'

function trouverChrome() {
  const donne = opt('--chrome', process.env.CHROME_PATH)
  if (donne) return donne
  const pistes = ['C:/Program Files/Google/Chrome/Application/chrome.exe', 'C:/Program Files (x86)/Google/Chrome/Application/chrome.exe', '/usr/bin/google-chrome']
  const t = pistes.find((p) => fs.existsSync(p))
  if (!t) { console.error('Chrome introuvable.'); process.exit(2) }
  return t
}
async function chargerPuppeteer() {
  const pistes = [
    path.join(RACINE, 'node_modules/puppeteer-core/lib/puppeteer/puppeteer-core.js'),
    'C:/Dev/wt-f3/node_modules/puppeteer-core/lib/puppeteer/puppeteer-core.js',
  ]
  for (const p of pistes) if (fs.existsSync(p)) return (await import('file:///' + p.replace(/\\/g, '/'))).default
  console.error('puppeteer-core introuvable.'); process.exit(2)
}

// les points du bloc qu'on suit à l'écran, en coordonnées de GÉOMÉTRIE
const REPERES = `(() => {
  const S = 28 // TERRAIN_SIZE / 2
  return [
    ['centre', 0, 0, 0],
    ['coinNO', -S, 0, -S], ['coinNE', S, 0, -S], ['coinSO', -S, 0, S], ['coinSE', S, 0, S],
  ]
})()`

const PROJETER = `((THREE_pos) => {
  const e = window.__exp, cam = e.camera
  const W = window.innerWidth, H = window.innerHeight
  const V = new (cam.position.constructor)()
  const out = {}
  for (const [nom, x, y, z] of ${REPERES}) {
    V.set(x, y, z); V.project(cam)
    out[nom] = { x: (V.x * 0.5 + 0.5) * W, y: (-V.y * 0.5 + 0.5) * H, z: V.z }
  }
  const d = new (cam.position.constructor)(); cam.getWorldDirection(d)
  return {
    ecran: out,
    visee: { x: d.x, y: d.y, z: d.z },
    cam: { x: cam.position.x, y: cam.position.y, z: cam.position.z },
    target: { x: e.controls.target.x, y: e.controls.target.y, z: e.controls.target.z },
    dist: cam.position.distanceTo(e.controls.target),
    polaire: e.controls.getPolarAngle(), azimut: e.controls.getAzimuthalAngle(),
    rotateSpeed: e.controls.rotateSpeed,
  }
})()`

const R2D = 180 / Math.PI
const angle = (a, b) => Math.acos(Math.max(-1, Math.min(1, a.x * b.x + a.y * b.y + a.z * b.z))) * R2D
const dpx = (a, b) => Math.hypot(a.x - b.x, a.y - b.y)

async function attendreImages(page, n) {
  await page.evaluate((k) => new Promise((res) => { let i = 0; const t = () => (++i >= k ? res() : requestAnimationFrame(t)); requestAnimationFrame(t) }), n)
}

async function main() {
  const puppeteer = await chargerPuppeteer()
  const nav = await puppeteer.launch({
    executablePath: trouverChrome(), headless: VISIBLE ? false : 'new',
    args: [`--window-size=${LARGEUR},${HAUTEUR + 120}`, '--use-angle=default'],
    defaultViewport: { width: LARGEUR, height: HAUTEUR },
  })
  const page = (await nav.pages())[0] || (await nav.newPage())
  const cdp = await page.target().createCDPSession()
  const journal = { etiquette: ETIQ, dx: DX, viewport: [LARGEUR, HAUTEUR], essais: [] }

  await page.goto(`http://localhost:${PORT}/`, { waitUntil: 'domcontentloaded', timeout: 60000 })
  await page.waitForFunction('!!(window.__exp && window.__exp.modes && window.__exp.controls)', { timeout: 60000 })
  await page.waitForFunction("!!document.getElementById('loading')?.classList.contains('hidden')", { timeout: 90000 })
  await attendreImages(page, 150)

  const CX = Math.round(LARGEUR / 2), CY = Math.round(HAUTEUR / 2)
  const souris = (type, x, y, b = 'left', bs = 1) =>
    cdp.send('Input.dispatchMouseEvent', { type, x, y, button: b, buttons: bs, clickCount: type === 'mousePressed' ? 1 : 0 })

  // ⚠️ **UN GLISSÉ D'ÉCHAUFFEMENT, ET IL N'EST PAS DÉCORATIF.** Le tout premier
  // `pointerdown` d'une session n'atteint pas OrbitControls (mesuré : 0,000°
  // pour 100 px, contre 0,447°/px ensuite). Sans lui, le premier candidat de la
  // liste rendrait zéro et paraîtrait « le plus stable » — l'artefact aurait
  // décidé du choix de sensation.
  await souris('mouseMoved', CX, CY, 'none', 0)
  await souris('mousePressed', CX, CY)
  await attendreImages(page, 3)
  await souris('mouseMoved', CX + 20, CY)
  await attendreImages(page, 20)
  await souris('mouseReleased', CX + 20, CY, 'left', 0)
  await attendreImages(page, 60)

  // ⚡ **ET ON DÉCENTRE LA CIBLE AVANT DE COMPARER.** Cible et centre du bloc
  // coïncident à l'ouverture (`target = 0,−1,5,0`) : les quatre candidats y
  // rendraient le même chiffre et la mesure ne dirait rien. Un déplacement
  // latéral (clic milieu = PAN, liaison constante de `boutons-camera.js`) met
  // la cible là où elle vit réellement après un geste — décentrée.
  await souris('mouseMoved', CX, CY, 'none', 0)
  await cdp.send('Input.dispatchMouseEvent', { type: 'mousePressed', x: CX, y: CY, button: 'middle', buttons: 4, clickCount: 1 })
  await attendreImages(page, 3)
  for (let i = 1; i <= 10; i++) {
    await cdp.send('Input.dispatchMouseEvent', { type: 'mouseMoved', x: CX - 18 * i, y: CY - 10 * i, button: 'middle', buttons: 4 })
    await attendreImages(page, 2)
  }
  await attendreImages(page, 80)
  await cdp.send('Input.dispatchMouseEvent', { type: 'mouseReleased', x: CX - 180, y: CY - 100, button: 'middle', buttons: 0 })
  // ⚠️ **ON ATTEND QUE LA CIBLE SOIT VRAIMENT IMMOBILE, ON NE COMPTE PAS LES
  // IMAGES.** `dampingFactor = 0,03` : le `panOffset` d'OrbitControls court
  // encore ~33 images après le relâché, et il décale la cible PENDANT le glissé
  // qu'on mesure. Premier jet : 60 images d'attente laissaient 14,85 px de
  // dérive résiduelle qu'on aurait imputée au pivot.
  journal.reposApresPan = await page.evaluate(() => new Promise((res) => {
    const e = window.__exp
    let prev = e.controls.target.clone(), stable = 0, i = 0
    const t = () => {
      i++
      const d = e.controls.target.distanceTo(prev)
      prev = e.controls.target.clone()
      stable = d < 1e-7 ? stable + 1 : 0
      if (stable >= 30 || i > 900) return res({ images: i, stable, dernierPas: d })
      requestAnimationFrame(t)
    }
    requestAnimationFrame(t)
  }))

  // l'état de départ, qu'on restaure entre chaque candidat
  const depart = await page.evaluate(() => {
    const e = window.__exp
    return {
      cam: e.camera.position.toArray(), target: e.controls.target.toArray(),
      depth: e.plinth?.depth ?? 7,
    }
  })
  journal.depart = depart

  async function restaurer() {
    await page.evaluate((d) => {
      const e = window.__exp
      e.camera.position.fromArray(d.cam)
      e.controls.target.fromArray(d.target)
      e.controls.update()
    }, depart)
    await attendreImages(page, 20)
  }

  async function essai(nom, poserCible) {
    await restaurer()
    const pose = await page.evaluate(poserCible)
    await attendreImages(page, 20)
    await souris('mouseMoved', CX, CY, 'none', 0)
    await attendreImages(page, 1)
    await souris('mousePressed', CX, CY)
    await attendreImages(page, 2)
    const avant = await page.evaluate(PROJETER)
    for (let i = 1; i <= 10; i++) { await souris('mouseMoved', CX + Math.round((DX * i) / 10), CY); await attendreImages(page, 1) }
    await attendreImages(page, REPOS)
    const apres = await page.evaluate(PROJETER)
    await souris('mouseReleased', CX + DX, CY, 'left', 0)
    await attendreImages(page, 4)
    const r = {
      nom, pose, avant, apres,
      dViseeDeg: angle(avant.visee, apres.visee),
      deriveCentrePx: dpx(avant.ecran.centre, apres.ecran.centre),
      deriveCoinsPx: ['coinNO', 'coinNE', 'coinSO', 'coinSE'].map((k) => dpx(avant.ecran[k], apres.ecran[k])),
      dAzimutDeg: Math.abs(apres.azimut - avant.azimut) * R2D,
    }
    r.deriveCoinsMaxPx = Math.max(...r.deriveCoinsPx)
    journal.essais.push(r)
    return r
  }

  // ① la cible d'aujourd'hui — le point visé au sol
  await essai('visee (aujourd’hui)', () => ({ cible: window.__exp.controls.target.toArray() }))
  // ② l'aplomb du centre du bloc, au sol
  await essai('centre du bloc, au sol', () => {
    const e = window.__exp
    e.controls.target.set(0, 0, 0); e.controls.update()
    return { cible: [0, 0, 0] }
  })
  // ③ le centre du VOLUME du bloc — socle compris
  await essai('centre du volume (socle)', () => {
    const e = window.__exp
    const d = e.plinth?.depth ?? 7
    e.controls.target.set(0, -d / 2, 0); e.controls.update()
    return { cible: [0, -d / 2, 0], depth: d }
  })
  // ④ le point du relief sous le curseur
  await essai('point sous le curseur', () => {
    const e = window.__exp
    const p = e.modes.hooks.pointUnder?.(0, 0)
    if (!p) return { cible: null, echec: 'pointUnder rend null' }
    e.controls.target.set(p.x, p.y, p.z); e.controls.update()
    return { cible: [p.x, p.y, p.z] }
  })

  fs.writeFileSync(path.join(ICI, `${ETIQ}.json`), JSON.stringify(journal, null, 1), 'utf8')
  await nav.close()

  const f = (x) => (x == null ? '—' : Number(x).toFixed(3))
  console.log(`\n=== R13 étape 3 — autour de quoi ? glissé de ${DX} px, écran ${LARGEUR}×${HAUTEUR} ===`)
  console.log('candidat                     cible (x,y,z)              dAzim°   dVisée°  dérive CENTRE px  dérive COINS max px')
  for (const r of journal.essais) {
    const c = r.pose?.cible ? r.pose.cible.map((v) => v.toFixed(2)).join(',') : String(r.pose?.echec || '—')
    console.log(
      `${r.nom.padEnd(28)} ${c.padEnd(25)} ${f(r.dAzimutDeg).padEnd(8)} ${f(r.dViseeDeg).padEnd(8)} ` +
      `${f(r.deriveCentrePx).padEnd(17)} ${f(r.deriveCoinsMaxPx)}`
    )
  }
  console.log(`\n→ .banc/R13/${ETIQ}.json`)
}

main().catch((e) => { console.error(e); process.exit(1) })
