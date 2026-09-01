// SONDE R25 bis — LES QUATRE CURSEURS DE MATIÈRE, ET CE QUI SE CACHE.
//
// ⛔ **LES CURSEURS SONT ACTIONNÉS PAR LEUR CHEMIN D'INTERFACE**, pas en écrivant
// `params` : `ctx.setMatScale` / `setSurfaceMatBump` / `setMatNoise` /
// `setMatAboveZero` sont ce qu'un doigt appelle. On les trouve par leur libellé
// dans le DOM du panneau Terrain.
//
// ⚠️ **CERTAINS CURSEURS NE VALIDENT QU'AU RELÂCHEMENT** — on envoie donc
// `input` PUIS `change`.
//
// ⚠️ **ET ON RELÈVE `window.__palierMachine` DANS LE MÊME RELEVÉ** : il pilote
// ombres, grain et `pixelRatio` avant tout curseur du studio.
import fs from 'node:fs'
import path from 'node:path'
import zlib from 'node:zlib'
import { fileURLToPath } from 'node:url'

const RACINE = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..')
const A = process.argv.slice(2)
const opt = (n, d = null) => { const i = A.indexOf(n); return i >= 0 && A[i + 1] ? A[i + 1] : d }
const PORT = Number(opt('--port', '5611'))
const SORTIE = opt('--sortie', path.join(RACINE, '.banc/R25/curseurs'))
fs.mkdirSync(SORTIE, { recursive: true })

async function chargerPuppeteer() {
  for (const p of [path.join(RACINE, 'node_modules/puppeteer-core/lib/puppeteer/puppeteer-core.js'),
    'C:/Dev/wt-f3/node_modules/puppeteer-core/lib/puppeteer/puppeteer-core.js']) {
    if (fs.existsSync(p)) return (await import('file:///' + p.split('\\').join('/'))).default
  }
  process.exit(2)
}
const dodo = (ms) => new Promise((r) => setTimeout(r, ms))

function lirePng(buf) {
  let p = 8, w = 0, h = 0, bits = 0, type = 0
  const mo = []
  while (p < buf.length) {
    const len = buf.readUInt32BE(p)
    const nom = buf.toString('ascii', p + 4, p + 8)
    const d = buf.subarray(p + 8, p + 8 + len)
    if (nom === 'IHDR') { w = d.readUInt32BE(0); h = d.readUInt32BE(4); bits = d[8]; type = d[9] }
    else if (nom === 'IDAT') mo.push(d)
    else if (nom === 'IEND') break
    p += 12 + len
  }
  if (bits !== 8) throw new Error('png non 8 bits')
  const ca = type === 6 ? 4 : type === 2 ? 3 : 1
  const brut = zlib.inflateSync(Buffer.concat(mo))
  const ligne = w * ca
  const out = Buffer.alloc(w * h * ca)
  let q = 0
  for (let y = 0; y < h; y++) {
    const f = brut[q++]
    const src = brut.subarray(q, q + ligne); q += ligne
    const dst = out.subarray(y * ligne, (y + 1) * ligne)
    const prev = y ? out.subarray((y - 1) * ligne, y * ligne) : null
    for (let x = 0; x < ligne; x++) {
      const a = x >= ca ? dst[x - ca] : 0
      const b = prev ? prev[x] : 0
      const c = prev && x >= ca ? prev[x - ca] : 0
      let v = src[x]
      if (f === 1) v += a
      else if (f === 2) v += b
      else if (f === 3) v += (a + b) >> 1
      else if (f === 4) { const pa = Math.abs(b - c), pb = Math.abs(a - c), pc = Math.abs(a + b - 2 * c); v += (pa <= pb && pa <= pc) ? a : (pb <= pc ? b : c) }
      dst[x] = v & 255
    }
  }
  return { w, h, ca, data: out }
}
function ecart(a, b) {
  const n = a.w * a.h
  let s = 0, g = 0, bouges = 0
  const La = new Float32Array(n), Lb = new Float32Array(n)
  for (let i = 0; i < n; i++) {
    const ia = i * a.ca, ib = i * b.ca
    La[i] = 0.299 * a.data[ia] + 0.587 * a.data[ia + 1] + 0.114 * a.data[ia + 2]
    Lb[i] = 0.299 * b.data[ib] + 0.587 * b.data[ib + 1] + 0.114 * b.data[ib + 2]
    const d = Math.abs(La[i] - Lb[i]); s += d; if (d > 2) bouges++
  }
  for (let y = 1; y < a.h; y++) for (let x = 1; x < a.w; x++) {
    const i = y * a.w + x
    g += Math.abs((Math.abs(La[i] - La[i - 1]) + Math.abs(La[i] - La[i - a.w])) - (Math.abs(Lb[i] - Lb[i - 1]) + Math.abs(Lb[i] - Lb[i - a.w])))
  }
  return { moy: +(s / n).toFixed(4), grad: +(g / ((a.h - 1) * (a.w - 1))).toFixed(4), pct: +(100 * bouges / n).toFixed(3) }
}

const puppeteer = await chargerPuppeteer()
const nav = await puppeteer.launch({ executablePath: 'C:/Program Files/Google/Chrome/Application/chrome.exe', headless: true, args: ['--headless=new', '--no-sandbox', '--enable-unsafe-swiftshader', '--window-size=1280,900'] })
const out = { quand: new Date().toISOString(), lignes: [] }
try {
  const page = await nav.newPage()
  const erreursGL = []
  page.on('console', (m) => { const t = m.text(); if (/Shader Error|not compiled|VALIDATE_STATUS false|ERROR: 0:/.test(t)) erreursGL.push(t.slice(0, 400)) })
  await page.setViewport({ width: 1280, height: 800 })
  await page.evaluateOnNewDocument(() => { try { localStorage.setItem('shibumap-ui-advanced', '1') } catch {} })
  await page.goto(`http://localhost:${PORT}/`, { waitUntil: 'domcontentloaded', timeout: 180000 })
  await page.waitForFunction(() => window.__exp?.composer, { timeout: 180000, polling: 200 })
  await dodo(22000)
  await page.keyboard.press('Escape')
  await page.evaluate(() => { const e = window.__exp; e.params.animations = false; e.params.paused = true })
  await dodo(3000)

  out.palier = await page.evaluate(() => {
    const p = window.__palierMachine
    return p ? { ombres: p.reglages?.ombres ?? null, grain: p.reglages?.grain ?? null, nuages: p.reglages?.nuages ?? null, ecran: p.signaux?.ecran ?? null } : null
  })

  const picker = () => page.evaluate(() => {
    const picks = [...document.querySelectorAll('.ce-mat-pick')]
    return picks.findIndex((n) => [...n.querySelectorAll('.ce-mat-vig')].some((b) => b.getAttribute('data-tip') === 'Verre'))
  })
  const iPick = await picker()

  // ⛔ **LA SECTION EST REPLIÉE PAR DÉFAUT (`section(..., { open: false })`), ET
  // UN PREMIER TOUR DE CETTE SONDE S'EST FAIT PRENDRE** : `offsetParent === null`
  // rendait TOUT invisible — vignettes, curseurs, y compris ceux qui agissent —,
  // et le relevé « le verre est caché » ne valait rien puisque tout l'était. On
  // ouvre la section AVANT de juger d'une visibilité, et le témoin est qu'au
  // moins un curseur soit visible.
  await page.evaluate(() => {
    for (const h of document.querySelectorAll('.ce-section-head')) {
      const t = h.querySelector('.ce-section-title')?.textContent || ''
      if (/Matière du relief/.test(t) && !h.parentElement.classList.contains('open')) h.click()
    }
  })
  await dodo(600)

  // --- ce qui est CACHÉ : la vignette du verre et le curseur « Rugosité » -----
  const clique = (tip) => page.evaluate(({ k, tip }) => {
    const p = [...document.querySelectorAll('.ce-mat-pick')][k]
    const b = [...p.querySelectorAll('.ce-mat-vig')].find((x) => x.getAttribute('data-tip') === tip)
    b.click()
  }, { k: iPick, tip })

  await clique('Roche brute')
  await dodo(9000)

  out.visibilite = await page.evaluate((k) => {
    const p = [...document.querySelectorAll('.ce-mat-pick')][k]
    const vis = (n) => n && getComputedStyle(n).display !== 'none' && n.offsetParent !== null
    const vignettes = [...p.querySelectorAll('.ce-mat-vig')].map((b) => ({ tip: b.getAttribute('data-tip'), visible: vis(b) }))
    // les curseurs de la section « Matière du relief » : la rangée porte son libellé
    const rangees = [...document.querySelectorAll('.ce-fx-controls')].flatMap((c) => [...c.children])
    const curseurs = rangees.map((r) => ({ texte: (r.textContent || '').trim().slice(0, 40), visible: vis(r) }))
    return { vignettes, curseurs, surSphere: !!window.__exp?.globe?._crop }
  }, iPick)

  // --- les quatre curseurs : chacun bougé par son chemin d'interface ---------
  const tire = async (nom) => {
    await page.evaluate(() => { for (let i = 0; i < 3; i++) window.__exp.composer.render(0) })
    const b = await page.screenshot({ type: 'png' })
    fs.writeFileSync(path.join(SORTIE, nom + '.png'), b)
    return lirePng(b)
  }
  // ⚠️ on passe par le MÊME chemin que le doigt : la rangée du panneau porte un
  // <input type=range>, on lui pose la valeur puis on émet input PUIS change.
  const bouge = (libelle, valeur) => page.evaluate(({ libelle, valeur }) => {
    const rangees = [...document.querySelectorAll('.ce-fx-controls')].flatMap((c) => [...c.children])
    const r = rangees.find((x) => (x.textContent || '').includes(libelle))
    if (!r) return { trouve: false }
    const inp = r.querySelector('input[type=range]')
    if (inp) {
      inp.value = String(valeur)
      // ⚠️ **CERTAINS CURSEURS NE VALIDENT QU'AU RELÂCHEMENT** : les deux.
      inp.dispatchEvent(new Event('input', { bubbles: true }))
      inp.dispatchEvent(new Event('change', { bubbles: true }))
      return { trouve: true, type: 'range', valeur: inp.value }
    }
    // ⚠️ **UNE BASCULE N'EST PAS UNE CASE À COCHER ICI** : `toggle()` (`kit.js`)
    // rend un `<button class="ce-toggle">` dont l'état vit dans la classe `on`.
    // Un premier tour de cette sonde cherchait `input[type=checkbox]` et
    // déclarait la bascule INTROUVABLE — l'instrument, pas le réglage.
    const btn = r.querySelector('button.ce-toggle')
    if (!btn) return { trouve: false }
    const etat = btn.classList.contains('on')
    if (etat !== !!valeur) btn.click()
    return { trouve: true, type: 'toggle', valeur: btn.classList.contains('on') }
  }, { libelle, valeur })

  const ref = await tire('00-ref')
  const etatDe = () => page.evaluate(() => {
    const u = window.__exp.globe.uniforms
    return {
      uMatOn: u.uMatOn.value, uMatRepeat: u.uMatRepeat.value, uMatBump: u.uMatBump.value,
      uMatNoiseOn: u.uMatNoiseOn.value, uMatNoiseCut: +u.uMatNoiseCut.value.toFixed(4),
      uMatAboveZero: u.uMatAboveZero.value, uMatBandeM: +u.uMatBandeM.value.toFixed(3),
      uMatNormalOn: u.uMatNormalOn.value,
    }
  })
  out.etatRef = await etatDe()

  const essais = [
    { cle: 'terrainMatScale', libelle: 'Échelle (tuilage)', de: 1, a: 4 },
    // ⚠️ **DE 0 À 3, PAS DE SA VALEUR DE DÉPART À 3.** Le premier tour bougeait
    // `uMatBump` de 2,08 (1,3 × le `normalScale` du préréglage) à 3 et rendait
    // **0,3535** — au-dessus du plancher (0,231), mais d'un facteur 1,5 : sous
    // la règle du dossier, un relevé unique dans ce voisinage ne décide de rien.
    // Les deux BOUTS du curseur tranchent, eux.
    { cle: 'terrainSurfaceBump', libelle: 'Relief de la matière', de: 0, a: 3, prealable: 0 },
    { cle: 'terrainMatNoise', libelle: 'Bruit (révèle la base)', de: 0, a: 0.8 },
    { cle: 'terrainMatAboveZero', libelle: 'Au-dessus du niveau zéro', de: false, a: true },
  ]
  for (const e of essais) {
    // certains essais ont besoin d'un point de départ explicite : on le pose, on
    // reprend la référence, et on ne compare alors que les deux BOUTS.
    let base = ref
    if (e.prealable != null) {
      await bouge(e.libelle, e.prealable)
      await dodo(2200)
      base = await tire(e.cle + '-bas')
    }
    const r = await bouge(e.libelle, e.a)
    await dodo(2500)
    const im = await tire(e.cle + '-haut')
    const et = await etatDe()
    const c = ecart(base, im)
    out.lignes.push({ ...e, pose: r, ...c, etat: et })
    console.log(e.libelle.padEnd(26), r.trouve ? 'posé' : '⛔ INTROUVABLE', 'moy', String(c.moy).padStart(8), 'grad', String(c.grad).padStart(8), '%', c.pct, JSON.stringify(et))
    // on remet au repos pour que les quatre soient indépendants
    if (e.de !== null) await bouge(e.libelle, e.de)
    await dodo(1800)
  }

  out.erreursGL = erreursGL
  if (erreursGL.length) console.log('⛔ ERREURS DE NUANCEUR : ' + erreursGL.slice(0, 2).join(' || '))
  console.log('\nvignette Verre visible :', out.visibilite.vignettes.find((v) => v.tip === 'Verre')?.visible)
  console.log('curseurs visibles :', out.visibilite.curseurs.filter((c) => c.visible).map((c) => c.texte.slice(0, 26)).join(' | '))
  console.log('curseurs cachés   :', out.visibilite.curseurs.filter((c) => !c.visible).map((c) => c.texte.slice(0, 26)).join(' | '))
  fs.writeFileSync(path.join(SORTIE, 'curseurs.json'), JSON.stringify(out, null, 2))
} finally {
  await nav.close()
}
