// DIAG R31 — L'APLAT VERT DES BASSES TERRES, À L'ÉCRAN, AVANT / APRÈS
//
// ⚠️ **A/B APPARIÉ DANS LA MÊME PAGE, PAS DEUX CHARGEMENTS.** Comparer deux
// builds aurait comparé deux jeux de tuiles (R28 §④). Ici, à chaque vue, on
// capture DEUX fois au même instant : une fois avec le poids de recollage
// vivant, une fois avec `uRecollage = 0` — c'est-à-dire exactement le nuanceur
// d'avant la tâche, puisque `mix(x, y, 0.0)` rend `x`.
//
// ⛔ **ET `majEchelleRampe` RÉÉCRIT L'UNIFORME À CHAQUE IMAGE** — c'est le faux
// zéro qui a coûté un tour de banc à R28. On la GÈLE pendant la bascule.
//
// ⚠️ **L'APLAT SE COMPTE, IL NE SE REGARDE PAS**, et le juge employé n'est pas
// le premier écrit : voir le bloc « cru puis réfuté » devant `decrire`. Pleine
// résolution 1 280 × 800 : un condensé annulerait le motif.
import fs from 'node:fs'
import path from 'node:path'
import { fileURLToPath } from 'node:url'

const RACINE = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..')
const args = process.argv.slice(2)
const opt = (n, d = null) => { const i = args.indexOf(n); return i >= 0 && args[i + 1] ? args[i + 1] : d }
const PORT = Number(opt('--port', '5731'))
const SORTIE = opt('--sortie', path.join(RACINE, '.banc/R31'))
const IMAGES = Number(opt('--images', '5'))
const dodo = (ms) => new Promise((r) => setTimeout(r, ms))

function trouverChrome() {
  const t = ['C:/Program Files/Google/Chrome/Application/chrome.exe',
    'C:/Program Files (x86)/Google/Chrome/Application/chrome.exe'].find((p) => fs.existsSync(p))
  if (!t) { console.error('Chrome introuvable'); process.exit(2) }
  return t
}
async function chargerPuppeteer() {
  for (const p of [
    path.join(RACINE, 'node_modules/puppeteer-core/lib/puppeteer/puppeteer-core.js'),
    'C:/Dev/wt-f3/node_modules/puppeteer-core/lib/puppeteer/puppeteer-core.js',
  ]) if (fs.existsSync(p)) return (await import('file:///' + p.split('\\').join('/'))).default
  process.exit(2)
}

// ── LE JUGE : moyenne d'images lue DANS le rAF (R28 §⑥⑦ : hors du rAF, le tampon
//    est déjà effacé et l'instrument annonce « rien ne se dessine » sur une page saine)
function poserJuge() {
  const R = window.__exp.renderer
  const gl = R.getContext()
  const W = gl.drawingBufferWidth
  const H = gl.drawingBufferHeight
  const px = new Uint8Array(W * H * 4)
  let acc = null
  let n = 0
  const etat = { W, H, erreur: null }
  window.__vv = etat
  function boucle() {
    try {
      gl.bindFramebuffer(gl.FRAMEBUFFER, null)
      gl.readPixels(0, 0, W, H, gl.RGBA, gl.UNSIGNED_BYTE, px)
      R.resetState?.()
      if (!acc) acc = new Float32Array(W * H * 3)
      for (let i = 0, j = 0; i < W * H; i++) { acc[j++] += px[i * 4]; acc[j++] += px[i * 4 + 1]; acc[j++] += px[i * 4 + 2] }
      n++
    } catch (err) { etat.erreur = String(err).slice(0, 140) }
    requestAnimationFrame(boucle)
  }
  etat.vider = () => { acc = null; n = 0 }
  etat.pret = (k) => n >= k
  etat.moyenne = () => {
    const N = W * H
    const M = new Uint8Array(N * 3)
    for (let i = 0; i < N * 3; i++) M[i] = Math.round(acc[i] / n)
    return { W, H, images: n, px: Array.from(M) }
  }
  requestAnimationFrame(boucle)
  return 'posé'
}

const clamp01 = (x) => (x < 0 ? 0 : x > 1 ? 1 : x)
const inv = (c) => { const s = c / 255; return s <= 0.04045 ? s / 12.92 : Math.pow((s + 0.055) / 1.055, 2.4) }
const fLab = (t) => (t > 0.008856451679035631 ? Math.cbrt(t) : t / (3 * 0.04280618311533888 ** 2) + 4 / 29)
function lab(r0, g0, b0) {
  const r = inv(r0), g = inv(g0), b = inv(b0)
  const X = (0.4124564 * r + 0.3575761 * g + 0.1804375 * b) / 0.95047
  const Y = 0.2126729 * r + 0.7151522 * g + 0.0721750 * b
  const Z = (0.0193339 * r + 0.1191920 * g + 0.9503041 * b) / 1.08883
  const fx = fLab(X), fy = fLab(Y), fz = fLab(Z)
  return [116 * fy - 16, 500 * (fx - fy), 200 * (fy - fz)]
}
const dE = (A, B) => Math.hypot(A[0] - B[0], A[1] - B[1], A[2] - B[2])

/**
 * ⛔ **CE QUE J'AI CRU PUIS RÉFUTÉ — LE PREMIER JUGE ÉTAIT AVEUGLE.**
 * J'ai d'abord compté les pixels à moins de ΔE 2 du PREMIER TEXEL de la table
 * vivante (`rgb(150, 168, 131)`, la butée basse d'Adrien). Résultat : **0 pixel,
 * avant comme après, sur les quatre vues**. La table n'est pas la dernière étape :
 * l'éclairage, le peigne des crêtes, l'albédo et le voile passent APRÈS elle, et
 * aucun pixel de l'écran ne porte le texel nu. **Un instrument qui rend zéro des
 * deux côtés ne mesure rien.**
 *
 * ➡️ **L'APLAT SE MESURE DONC PAR CE QU'IL EST — une grande surface VERTE sans
 * variation** — et non par une couleur nommée d'avance :
 *   · `vertPx` : les pixels de la famille olive/verte (L*a*b*, `a* < −2`) ;
 *   · `gradientVert` : la variation locale de luminance SUR EUX. Un aplat a un
 *     gradient bas ; une plaine littorale nuancée en a un plus haut ;
 *   · `binMaxVert` : la part des verts qui tombent dans UNE SEULE case de 2 ΔE.
 *     C'est la mesure la plus directe de « une seule couleur sur des kilomètres ».
 */
function decrire(img) {
  const { W, H, px } = img
  const N = W * H
  let sl = 0, sl2 = 0, sgr = 0
  let vertPx = 0, sgrVert = 0
  const cases = new Map()
  for (let y = 0; y < H; y++) {
    for (let x = 0; x < W; x++) {
      const j = (y * W + x) * 3
      const r = px[j], g = px[j + 1], b = px[j + 2]
      const l = 0.299 * r + 0.587 * g + 0.114 * b
      sl += l; sl2 += l * l
      const lx = x + 1 < W ? 0.299 * px[j + 3] + 0.587 * px[j + 4] + 0.114 * px[j + 5] : l
      const k = j + W * 3
      const ly = y + 1 < H ? 0.299 * px[k] + 0.587 * px[k + 1] + 0.114 * px[k + 2] : l
      const gr = Math.abs(lx - l) + Math.abs(ly - l)
      sgr += gr
      const L = lab(r, g, b)
      if (L[1] < -2) {
        vertPx++
        sgrVert += gr
        const cle = `${Math.round(L[0] / 2)}|${Math.round(L[1] / 2)}|${Math.round(L[2] / 2)}`
        cases.set(cle, (cases.get(cle) || 0) + 1)
      }
    }
  }
  const tri = [...cases.values()].sort((a, b) => b - a)
  let cumul = 0
  let binsMoitie = 0
  for (const v of tri) { cumul += v; binsMoitie++; if (cumul >= vertPx / 2) break }
  const ml = sl / N
  return {
    pixels: N,
    vertPx,
    vertPct: +(100 * vertPx / N).toFixed(2),
    gradientVert: vertPx ? +(sgrVert / vertPx).toFixed(4) : 0,
    binMaxVert: vertPx ? +(100 * tri[0] / vertPx).toFixed(2) : 0,
    binsPourLaMoitieDesVerts: binsMoitie,
    luminance: +ml.toFixed(3),
    sigma: +Math.sqrt(Math.max(0, sl2 / N - ml * ml)).toFixed(3),
    gradient: +(sgr / N).toFixed(4),
  }
}

/**
 * ⚡ **COMBIEN DES VERTS D'AVANT LA BASCULE ONT CHANGÉ ?** C'est la ligne qui
 * départage « le recollage ne touche pas ces verts-là » de « ces verts-là ne
 * viennent pas du crop ». Hors de l'emprise, `uRecollage` ne peut RIEN faire :
 * `dedansCrop` vaut zéro et le régime du monde a déjà la main (R28 §③).
 */
function vertsQuiChangent(avant, apres) {
  let verts = 0
  let bouges = 0
  for (let i = 0; i < avant.px.length; i += 3) {
    const L = lab(avant.px[i], avant.px[i + 1], avant.px[i + 2])
    if (L[1] >= -2) continue
    verts++
    const d = Math.abs(avant.px[i] - apres.px[i])
      + Math.abs(avant.px[i + 1] - apres.px[i + 1])
      + Math.abs(avant.px[i + 2] - apres.px[i + 2])
    if (d > 0) bouges++
  }
  return { verts, bouges, pct: verts ? +(100 * bouges / verts).toFixed(2) : 0 }
}

function differents(a, b) {
  let n = 0
  let somme = 0
  for (let i = 0; i < a.px.length; i += 3) {
    const d = Math.abs(a.px[i] - b.px[i]) + Math.abs(a.px[i + 1] - b.px[i + 1]) + Math.abs(a.px[i + 2] - b.px[i + 2])
    if (d > 0) { n++; somme += d / 3 }
  }
  return { pixels: n, pct: +(100 * n / (a.px.length / 3)).toFixed(2), ecartMoyenSurEux: n ? +(somme / n).toFixed(2) : 0 }
}

const puppeteer = await chargerPuppeteer()
const nav = await puppeteer.launch({
  executablePath: trouverChrome(), headless: true,
  args: ['--headless=new', '--no-sandbox', '--enable-unsafe-swiftshader', '--window-size=1280,900'],
})
fs.mkdirSync(path.join(SORTIE, 'vues'), { recursive: true })

// ⚠️ **LES DEUX LIEUX D'ADRIEN, AUX ZOOMS QU'IL A MONTRÉS** (R28 §⑤).
const VUES = [
  { nom: 'reunion-z13', lat: -21.115, lon: 55.536, zoom: 13 },
  { nom: 'reunion-z12', lat: -21.115, lon: 55.536, zoom: 12 },
  { nom: 'borneo-z13', lat: 5.98, lon: 116.07, zoom: 13 },
  { nom: 'borneo-z10', lat: 5.98, lon: 116.07, zoom: 10 },
]

const rapport = { quand: new Date().toISOString(), port: PORT, images: IMAGES, vues: [] }
try {
  const page = await nav.newPage()
  await page.setViewport({ width: 1280, height: 800 })
  const journal = []
  page.on('pageerror', (e) => journal.push('pageerror: ' + String(e.message).slice(0, 220)))
  page.on('console', (m) => { if (/not compiled|not linked|ERROR: 0:/.test(m.text())) journal.push('SHADER: ' + m.text().slice(0, 400)) })
  await page.evaluateOnNewDocument(() => { try { localStorage.setItem('shibumap-ui-advanced', '1') } catch {} })
  await page.goto('http://localhost:' + PORT + '/', { waitUntil: 'domcontentloaded', timeout: 180000 })
  await page.waitForFunction(() => window.__exp?.modes && window.__exp?.globe, { timeout: 180000, polling: 100 })
  await dodo(10000)
  await page.keyboard.press('Escape')
  await dodo(2500)
  await page.evaluate(() => { document.body.classList.add('ce-railL-off', 'ce-railR-off') })
  await page.evaluate(poserJuge)
  await page.evaluate(() => { window.__exp.params.animations = false })
  rapport.gpu = await page.evaluate(() => {
    const gl = window.__exp?.renderer?.getContext?.()
    const d = gl?.getExtension('WEBGL_debug_renderer_info')
    return d ? String(gl.getParameter(d.UNMASKED_RENDERER_WEBGL)) : 'inconnu'
  })
  console.log('pilote :', rapport.gpu)

  const capture = async () => {
    await page.evaluate(() => window.__vv.vider())
    await page.waitForFunction((n) => window.__vv.pret(n), { polling: 30, timeout: 60000 }, IMAGES)
    return page.evaluate(() => window.__vv.moyenne())
  }

  for (const V of VUES) {
    await page.evaluate((a) => window.__exp.modes._rescale(a, 'DIAG R31 vues'), V)
    await page.waitForFunction(() => { const g = window.__exp.globe; return !g || g.tuilesEnVol() === 0 }, { polling: 250, timeout: 90000 }).catch(() => {})
    await dodo(9000)

    const etat = await page.evaluate(() => {
      const e = window.__exp
      const u = e.globe.uniforms
      const t2 = u.uRampCrop?.value
      const P = window.__palierMachine || {}
      return {
        altM: e.modes.altM, crop: !!e.globe._crop, mode: e.modes.mode,
        uRecollage: u.uRecollage.value,
        uReliefBas: u.uReliefBas.value, uLandMax: u.uLandMax.value,
        uHeightPivot: u.uHeightPivot.value, uHeightContrast: u.uHeightContrast.value,
        // ⛔ LA BUTÉE BASSE, RELUE OCTET PAR OCTET dans la table VIVANTE
        butee: t2?.image?.data ? [t2.image.data[0], t2.image.data[1], t2.image.data[2]] : null,
        palier: P.palier, palierNom: P.nom, grain: P.grain, ombres: P.ombres,
        pixelRatio: e.renderer.getPixelRatio(),
      }
    })
    if (!etat.butee) { console.log(V.nom, '⛔ pas de table 2D — vue ignorée'); continue }

    // ── APRÈS : le recollage vivant
    const apres = await capture()
    await page.screenshot({ path: path.join(SORTIE, 'vues', V.nom + '-apres.png') })
    // ── LE TÉMOIN NUL : deux captures du MÊME état. Tout ce qui diffère ici est du bruit.
    const temoin = await capture()

    // ── AVANT : on GÈLE l'écrivain, puis on remet le poids à zéro
    await page.evaluate(() => {
      const g = window.__exp.globe
      g.__majGelee = g.majEchelleRampe
      g.majEchelleRampe = () => null
      g.uniforms.uRecollage.value = 0
    })
    await dodo(1500)
    const avant = await capture()
    await page.screenshot({ path: path.join(SORTIE, 'vues', V.nom + '-avant.png') })
    const gele = await page.evaluate(() => window.__exp.globe.uniforms.uRecollage.value)
    // ── RETOUR : l'écrivain reprend la main
    await page.evaluate(() => {
      const g = window.__exp.globe
      if (g.__majGelee) { g.majEchelleRampe = g.__majGelee; delete g.__majGelee }
    })

    const ligne = {
      nom: V.nom, ...V, etat,
      geleA: gele,
      temoinNul: differents(apres, temoin),
      bascule: differents(avant, apres),
      vertsQuiChangent: vertsQuiChangent(avant, apres),
      avant: decrire(avant),
      apres: decrire(apres),
    }
    rapport.vues.push(ligne)
    console.log(`\n[${V.nom}] alt=${Math.round(etat.altM)} m crop=${etat.crop} uRecollage=${etat.uRecollage.toFixed(4)} (gelé à ${gele})`
      + ` | butée basse = rgb(${etat.butee.join(', ')})`
      + `\n   témoin nul : ${ligne.temoinNul.pixels} px (${ligne.temoinNul.pct} %)`
      + ` | bascule : ${ligne.bascule.pixels} px (${ligne.bascule.pct} %), écart moyen sur eux ${ligne.bascule.ecartMoyenSurEux}/255`
      + `\n   ⚡ VERTS : ${ligne.avant.vertPx} px (${ligne.avant.vertPct} %) → ${ligne.apres.vertPx} px (${ligne.apres.vertPct} %)`
      + ` — dont ${ligne.vertsQuiChangent.bouges} (${ligne.vertsQuiChangent.pct} %) ONT CHANGÉ à la bascule`
      + `\n   ⚡ APLAT — part des verts dans UNE case de 2 ΔE : ${ligne.avant.binMaxVert} % → ${ligne.apres.binMaxVert} %`
      + ` · cases pour la moitié des verts : ${ligne.avant.binsPourLaMoitieDesVerts} → ${ligne.apres.binsPourLaMoitieDesVerts}`
      + `\n   ⚡ gradient SUR LES VERTS : ${ligne.avant.gradientVert} → ${ligne.apres.gradientVert}`
      + `\n   gradient global ${ligne.avant.gradient} → ${ligne.apres.gradient} · σ ${ligne.avant.sigma} → ${ligne.apres.sigma}`)
  }
  rapport.journal = journal
  if (journal.length) console.log('\n⛔ JOURNAL :', journal.join('\n'))
} finally { await nav.close() }
fs.writeFileSync(path.join(SORTIE, 'vues.json'), JSON.stringify(rapport, null, 1))
console.log('\nécrit : ' + path.join(SORTIE, 'vues.json'))
