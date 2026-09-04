// SONDE CN4 — LE CARTOUCHE DIT-IL LA VÉRITÉ ? Relevé À L'ÉCRAN, pas dans le code.
//
// ══════════ CE QU'ELLE COMPARE, ET POURQUOI ═════════════════════════════════
//
// Le noteur (CN3 §8) a relevé, Majorque, `demZoom = 15` : la surface dessinait
// du **z16** pendant que le cartouche affichait **« net à z13 »**. La sonde
// remesure exactement ces deux grandeurs, sur la MÊME image :
//
//   ① **ce qui est DESSINÉ** — `globe._zCropServi`, la valeur que `_traverse`
//      prescrit à toute l'emprise, lue dans l'objet vivant ;
//   ② **ce qui est ANNONCÉ** — le `textContent` du libellé `.ce-label` du
//      sélecteur « Détail (zoom) », lu dans le DOM, puis passé au crible de
//      `/net à z(\d+)/`. **On lit le texte de l'écran, pas la fonction qui
//      l'écrit** : c'est toute la différence entre CN2 et ce relevé.
//   ③ **ce que la donnée peut** — `dem.maxZoom` (`getDemMaxZoom`). Le cartouche
//      doit dire « plafond de la donnée ici » quand, et seulement quand, la
//      finesse servie a atteint ce que la région sert. MESURÉ par cette sonde :
//      **17** à Zermatt, **16** en Beauce et à Majorque, **12** au centre de
//      l'Australie — donc parfois SOUS `ZOOM_SOCLE`.
//
// ⚠️ **UN RELEVÉ SUR UNE IMAGE NE PROUVE RIEN.** La sonde est armée en continu
// (`requestAnimationFrame`) et compte les images où ① ≠ ②. Une seule image en
// écart suffit à faire échouer une cellule : le cartouche n'a pas le droit de
// mentir « seulement pendant l'affinage », c'est précisément là qu'Adrien
// regarde.
//
// ⚠️ **ET ON PROUVE QU'ON REGARDE QUELQUE CHOSE** : `cartoucheTrouve`,
// `cropVivant`, `imagesRelevees`. Une cellule sans cartouche dans le DOM ou sans
// crop est déclarée INVALIDE et ne produit aucun verdict.
//
// EMPLOI
//   node scripts/sonde-cn4-cartouche.mjs --port 9601 --lieu majorque \
//     --altitudes 5000,2000,900,300 --cpu 4
// Sort `.banc/CN4/<etiquette>.json` et, avec `--cliches <dossier>`, une capture
// par poste.

import fs from 'node:fs'
import path from 'node:path'
import { fileURLToPath } from 'node:url'

const RACINE = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..')
const A = process.argv.slice(2)
const opt = (n, d = null) => { const i = A.indexOf(n); return i >= 0 && A[i + 1] !== undefined ? A[i + 1] : d }
const PORT = Number(opt('--port', '9601'))
const CPU = Number(opt('--cpu', '4'))
const LIEU = opt('--lieu', 'majorque')
const ZOOM_BLOC = Number(opt('--zoombloc', '15'))
const ALTS = String(opt('--altitudes', '5000,2000,900,300')).split(',').map(Number).filter((v) => v > 0)
const ETIQ = opt('--etiquette', `${LIEU}-z${ZOOM_BLOC}`)
const SORTIE = opt('--sortie', path.join(RACINE, '.banc', 'CN4'))
const CLICHES = opt('--cliches', null)
const LARGEUR = 1280, HAUTEUR = 720
const dodo = (ms) => new Promise((r) => setTimeout(r, ms))

const LIEUX = {
  majorque: [39.62, 2.98],    // le lieu d'Adrien — MESURÉ : maxZoom 16
  beauce: [48.20, 1.72],      // France — MESURÉ : maxZoom 16
  zermatt: [46.02, 7.75],     // Suisse — MESURÉ : maxZoom 17 (swissALTI3D)
  alpes: [45.92, 6.87],
  bretagne: [48.38, -4.49],
  outback: [-23.70, 133.88],  // hors Europe — MESURÉ : maxZoom 12, SOUS le socle z13
}

function trouverChrome() {
  const donne = opt('--chrome', process.env.CHROME_PATH)
  if (donne) return donne
  const t = ['C:/Program Files/Google/Chrome/Application/chrome.exe', 'C:/Program Files (x86)/Google/Chrome/Application/chrome.exe', '/usr/bin/google-chrome'].find((p) => fs.existsSync(p))
  if (!t) { console.error('Chrome introuvable — passe --chrome <chemin>.'); process.exit(2) }
  return t
}
async function chargerPuppeteer() {
  for (const p of [
    path.join(RACINE, 'node_modules/puppeteer-core/lib/puppeteer/puppeteer-core.js'),
    'C:/Dev/wt-f3/node_modules/puppeteer-core/lib/puppeteer/puppeteer-core.js',
  ]) if (fs.existsSync(p)) return (await import('file:///' + p.split('\\').join('/'))).default
  console.error('puppeteer-core introuvable'); process.exit(2)
}

// ═══════════════ L'INSTRUMENT, POSÉ DANS LA PAGE ════════════════════════════
function INSTRUMENTER() {
  const e = window.__exp
  if (!e || !e.globe) return 'pas de globe'
  if (window.__cn4) return 'déjà posé'
  const P = { phase: 'attente', poste: null, images: [] }
  window.__cn4 = P
  // le libellé du sélecteur « Détail (zoom) », dans le DOM — pas la fonction
  const libelle = () => {
    for (const n of document.querySelectorAll('.ce-label')) {
      const t = n.textContent || ''
      if (t.startsWith('Détail (zoom)')) return t
    }
    return null
  }
  const battre = () => {
    const g = e.globe
    const txt = libelle()
    const m = txt && /net à z(\d+)/.exec(txt)
    const d = e.dem
    P.images.push({
      phase: P.phase, poste: P.poste, t: Math.round(performance.now()),
      cartoucheTrouve: txt !== null,
      libelle: txt,
      annonce: m ? +m[1] : null,
      plafondDit: !!(txt && txt.includes('plafond de la donnée ici')),
      servi: g._zCropServi || 0,
      cible: g._zCropCible || 0,
      cropVivant: !!g._crop,
      demZoom: e.params?.demZoom ?? null,
      maxZoom: d?.maxZoom ?? null,
      alt: Math.round(e.altitudeCadrageM?.() ?? 0),
    })
    if (P.images.length > 40000) P.images.splice(0, 8000)
    requestAnimationFrame(battre)
  }
  requestAnimationFrame(battre)
  return 'posé'
}

const uniq = (xs) => [...new Set(xs.map((v) => JSON.stringify(v)))].map((v) => JSON.parse(v))

async function attendreCalme(page, maxMs) {
  const a = Date.now(); let precedent = null; let stableDepuis = null
  while (Date.now() - a < maxMs) {
    const e = await page.evaluate(() => { const g = window.__exp.globe; return { n: g.tiles.size, file: g.queue.length, vol: g.inFlight } })
    const cle = `${e.n}/${e.file}/${e.vol}`
    if (e.file === 0 && e.vol === 0 && cle === precedent) {
      if (stableDepuis === null) stableDepuis = Date.now()
      else if (Date.now() - stableDepuis > 1500) return { ms: Date.now() - a, expire: false }
    } else stableDepuis = null
    precedent = cle
    await dodo(200)
  }
  return { ms: Date.now() - a, expire: true }
}

async function lancer() {
  fs.mkdirSync(SORTIE, { recursive: true })
  if (CLICHES) fs.mkdirSync(CLICHES, { recursive: true })
  const puppeteer = await chargerPuppeteer()
  const nav = await puppeteer.launch({
    executablePath: trouverChrome(), headless: 'new',
    args: [`--window-size=${LARGEUR},${HAUTEUR + 120}`, '--use-angle=default', '--no-sandbox'],
    defaultViewport: { width: LARGEUR, height: HAUTEUR, deviceScaleFactor: 1 },
  })
  const page = (await nav.pages())[0] || (await nav.newPage())
  const cdp = await page.target().createCDPSession()
  if (CPU > 1) await cdp.send('Emulation.setCPUThrottlingRate', { rate: CPU })
  const erreurs = []
  page.on('pageerror', (er) => erreurs.push('pageerror: ' + String(er.message).slice(0, 200)))

  const journal = { etiquette: ETIQ, port: PORT, cpu: CPU, lieu: LIEU, latlon: LIEUX[LIEU], zoomBloc: ZOOM_BLOC, altitudes: ALTS, date: new Date().toISOString(), postes: [] }
  await page.goto(`http://127.0.0.1:${PORT}/`, { waitUntil: 'domcontentloaded', timeout: 60000 })
  await page.waitForFunction('!!(window.__exp && window.__exp.globe)', { timeout: 120000 })
  await page.waitForFunction("!!document.getElementById('loading')?.classList.contains('hidden')", { timeout: 240000 })
  await page.keyboard.press('Escape'); await dodo(500)
  // ⚠️ **LE VOILE `.ce-elemwrap` AVALE LES GESTES** — on le retire, comme CN1.
  await page.evaluate(() => { document.body.classList.remove('ce-hub'); document.querySelector('.ce-hubveil')?.remove(); document.querySelectorAll('.ce-elemwrap').forEach((n) => n.remove()) })
  // ⛔ la pose de démarrage arrive après plusieurs secondes
  await page.waitForFunction('!(window.__exp.modes && (window.__exp.modes.busy || window.__exp.modes.travel))', { timeout: 90000, polling: 200 }).catch(() => { journal.busyDemarrage = true })
  await dodo(2500)

  const [lat, lon] = LIEUX[LIEU] || LIEUX.majorque
  await page.evaluate(async ({ la, lo, z }) => {
    const m = window.__exp.modes
    if (m.mode === 'orbital') { await m.diveTo?.({ lat: la, lon: lo }); await new Promise((r) => setTimeout(r, 3000)) }
    await m._rescale({ lat: la, lon: lo, zoom: z }, 'CN4')
  }, { la: lat, lo: lon, z: ZOOM_BLOC })
  await dodo(3000)
  journal.calmeArrivee = await attendreCalme(page, 180000)
  journal.instrument = await page.evaluate(INSTRUMENTER)
  journal.plafondSource = await page.evaluate(() => {
    const d = window.__exp.dem
    return d ? { zoom: d.zoom, source: d.demSource, maxZoom: d.maxZoom } : null
  })

  for (const alt of ALTS) {
    await page.evaluate((p) => { window.__cn4.phase = 'vol'; window.__cn4.poste = p }, alt)
    const pas = await page.evaluate(async (a) => {
      const e = window.__exp, cam = e.camera, ct = e.controls
      ct.minDistance = 1e-6; ct.maxDistance = 1e12
      const dir = cam.position.clone().sub(ct.target).normalize()
      const out = []
      for (let i = 0; i < 60; i++) {
        const cur = e.altitudeCadrageM()
        if (!Number.isFinite(cur) || cur <= 0) break
        const d = cam.position.distanceTo(ct.target)
        const nd = d * (a / cur)
        if (!Number.isFinite(nd) || nd <= 0) break
        cam.position.copy(ct.target).addScaledVector(dir, nd)
        ct.update?.()
        await new Promise((r) => setTimeout(r, 120))
        out.push(Math.round(e.altitudeCadrageM()))
        if (Math.abs(e.altitudeCadrageM() - a) / a < 0.004) break
      }
      return out
    }, alt)
    await dodo(1500)
    const calme = await attendreCalme(page, 120000)
    await page.evaluate(() => { window.__cn4.phase = 'releve' })
    await dodo(4000) // ≈ 240 images à 60 Hz, jamais une seule
    await page.evaluate(() => { window.__cn4.phase = 'vol' })
    const im = await page.evaluate((p) => JSON.parse(JSON.stringify(window.__cn4.images.filter((i) => i.phase === 'releve' && i.poste === p))), alt)

    const valide = im.length >= 20 && im.every((i) => i.cartoucheTrouve && i.cropVivant)
    // ⚠️ **CE QU'IL FAUT ANNONCER, C'EST LE TEXEL, PAS LA PRESCRIPTION.** Quand
    // la région plafonne SOUS le prescrit (mesuré : `maxZoom` 12 pour un
    // `_zCropServi` de 13 au centre de l'Australie, où `ZOOM_SOCLE` fait
    // plancher), la source rend un ancêtre surzoomé : le niveau réellement
    // dessiné est celui de la donnée. L'attendu est donc `min(servi, maxZoom)`.
    const attendu = (i) => (i.servi && i.maxZoom != null ? Math.min(i.servi, i.maxZoom) : i.servi)
    const ecarts = im.filter((i) => i.annonce !== attendu(i))
    const maxZoom = uniq(im.map((i) => i.maxZoom))
    // le cartouche doit dire « plafond » exactement quand servi ≥ maxZoom
    const plafondFaux = im.filter((i) => i.plafondDit !== (i.maxZoom != null && i.servi >= i.maxZoom))
    const poste = {
      altVisee: alt, pas, calme, imagesRelevees: im.length, valide,
      altReelle: im.length ? im[Math.floor(im.length / 2)].alt : null,
      servi: uniq(im.map((i) => i.servi)),
      annonce: uniq(im.map((i) => i.annonce)),
      libelles: uniq(im.map((i) => i.libelle)),
      maxZoom, demZoom: uniq(im.map((i) => i.demZoom)),
      ecarts: ecarts.length,
      exemplesEcart: uniq(ecarts.slice(0, 5).map((i) => ({ servi: i.servi, maxZoom: i.maxZoom, attendu: attendu(i), annonce: i.annonce, libelle: i.libelle }))),
      plafondFaux: plafondFaux.length,
      exemplesPlafond: uniq(plafondFaux.slice(0, 3).map((i) => ({ servi: i.servi, maxZoom: i.maxZoom, libelle: i.libelle }))),
    }
    journal.postes.push(poste)
    console.log(`[${ETIQ}] ${alt} m → alt ${poste.altReelle} · valide ${valide} · images ${im.length}`)
    console.log(`         dessiné ${JSON.stringify(poste.servi)} · annoncé ${JSON.stringify(poste.annonce)} · maxZoom ${JSON.stringify(maxZoom)} · ⚡ ÉCARTS ${poste.ecarts}/${im.length} · plafond faux ${poste.plafondFaux}`)
    console.log(`         libellé : ${JSON.stringify(poste.libelles)}`)
    if (CLICHES) {
      const f = path.join(CLICHES, `${ETIQ}-${alt}m.png`)
      await page.screenshot({ path: f })
      poste.cliche = f
    }
  }

  journal.erreurs = erreurs
  journal.total = { ecarts: journal.postes.reduce((s, p) => s + p.ecarts, 0), images: journal.postes.reduce((s, p) => s + p.imagesRelevees, 0), plafondFaux: journal.postes.reduce((s, p) => s + p.plafondFaux, 0) }
  const nom = path.join(SORTIE, `${ETIQ}.json`)
  fs.writeFileSync(nom, JSON.stringify(journal, null, 1))
  console.log(`\n=== ${ETIQ} : ${journal.total.ecarts} écarts sur ${journal.total.images} images · plafond faux ${journal.total.plafondFaux}`)
  if (erreurs.length) console.log(`⚠️ ${erreurs.length} erreurs : ${erreurs.slice(0, 3).join(' | ')}`)
  console.log('→', nom)
  await nav.close()
}
lancer().catch((e) => { console.error(e); process.exit(1) })
