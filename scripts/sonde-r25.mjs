// SONDE R25 — LES DIX-SEPT VIGNETTES DE MATIÈRE, UNE PAR UNE, À L'ÉCRAN.
//
// ⛔ **ELLE CLIQUE, ELLE N'ÉCRIT PAS `params`.** Le chemin d'un doigt est
// `.ce-mat-vig` → `ctx.setSurfaceMat` → `terrain.setMaterialMode` +
// `blockGrid.restyle` + `refreshAll` (donc `contexteCrop → poserHabillage`).
// Écrire `params.terrainSurfaceMat` à la main sauterait les trois derniers et
// mesurerait autre chose que ce que voit Adrien.
//
// ⚠️ **PLEINE RÉSOLUTION, JAMAIS DE CONDENSÉ.** Une matière EST un motif fin :
// un rééchantillonnage 64×40 l'annule (leçon du dossier).
//
// ⚠️ **`.ce-hubveil` MANGE TOUS LES GESTES** — Échap avant tout.
//
// Sortie : un JSON par vignette avec moy (écart moyen sur 255) et grad (écart
// moyen des gradients), plus les PNG pleine résolution.
import fs from 'node:fs'
import path from 'node:path'
import zlib from 'node:zlib'
import { fileURLToPath } from 'node:url'

const RACINE = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..')
const A = process.argv.slice(2)
const opt = (n, d = null) => { const i = A.indexOf(n); return i >= 0 && A[i + 1] ? A[i + 1] : d }
const PORT = Number(opt('--port', '5611'))
const SORTIE = opt('--sortie', path.join(RACINE, '.banc/R25/vignettes'))
const ORBITE = A.includes('--orbite')
const GARDE_PNG = !A.includes('--sans-png')
fs.mkdirSync(SORTIE, { recursive: true })

async function chargerPuppeteer() {
  for (const p of [path.join(RACINE, 'node_modules/puppeteer-core/lib/puppeteer/puppeteer-core.js'),
    'C:/Dev/wt-f3/node_modules/puppeteer-core/lib/puppeteer/puppeteer-core.js']) {
    if (fs.existsSync(p)) return (await import('file:///' + p.split('\\').join('/'))).default
  }
  console.error('puppeteer-core introuvable'); process.exit(2)
}
const dodo = (ms) => new Promise((r) => setTimeout(r, ms))

// --- lecteur PNG minimal (RGBA 8 bits, filtres 0..4) ------------------------
function lirePng(buf) {
  let p = 8, w = 0, h = 0, bits = 0, type = 0
  const morceaux = []
  while (p < buf.length) {
    const len = buf.readUInt32BE(p)
    const nom = buf.toString('ascii', p + 4, p + 8)
    const data = buf.subarray(p + 8, p + 8 + len)
    if (nom === 'IHDR') { w = data.readUInt32BE(0); h = data.readUInt32BE(4); bits = data[8]; type = data[9] }
    else if (nom === 'IDAT') morceaux.push(data)
    else if (nom === 'IEND') break
    p += 12 + len
  }
  if (bits !== 8) throw new Error('png non 8 bits')
  const canaux = type === 6 ? 4 : type === 2 ? 3 : type === 0 ? 1 : 0
  if (!canaux) throw new Error('png type ' + type)
  const brut = zlib.inflateSync(Buffer.concat(morceaux))
  const ligne = w * canaux
  const out = Buffer.alloc(w * h * canaux)
  let q = 0
  for (let y = 0; y < h; y++) {
    const f = brut[q++]
    const src = brut.subarray(q, q + ligne); q += ligne
    const dst = out.subarray(y * ligne, (y + 1) * ligne)
    const prev = y ? out.subarray((y - 1) * ligne, y * ligne) : null
    for (let x = 0; x < ligne; x++) {
      const a = x >= canaux ? dst[x - canaux] : 0
      const b = prev ? prev[x] : 0
      const c = prev && x >= canaux ? prev[x - canaux] : 0
      let v = src[x]
      if (f === 1) v += a
      else if (f === 2) v += b
      else if (f === 3) v += (a + b) >> 1
      else if (f === 4) { const pa = Math.abs(b - c), pb = Math.abs(a - c), pc = Math.abs(a + b - 2 * c); v += (pa <= pb && pa <= pc) ? a : (pb <= pc ? b : c) }
      dst[x] = v & 255
    }
  }
  return { w, h, canaux, data: out }
}
const luma = (im, i) => 0.299 * im.data[i * im.canaux] + 0.587 * im.data[i * im.canaux + 1] + 0.114 * im.data[i * im.canaux + 2]

// moy = écart moyen de luminance ; grad = écart moyen du gradient (le MOTIF).
// ⚠️ chroma en plus : la leçon ⑤ du dossier — un instrument en luminance seule
// est aveugle à un effacement qui éclaircit.
function compare(a, b) {
  if (a.w !== b.w || a.h !== b.h) throw new Error('tailles differentes')
  const n = a.w * a.h
  let sd = 0, sg = 0, sc = 0, bouges = 0
  const La = new Float32Array(n), Lb = new Float32Array(n)
  for (let i = 0; i < n; i++) { La[i] = luma(a, i); Lb[i] = luma(b, i) }
  for (let i = 0; i < n; i++) {
    const d = Math.abs(La[i] - Lb[i]); sd += d; if (d > 2) bouges++
    const ca = a.canaux, ia = i * ca, ib = i * b.canaux
    const cha = Math.max(a.data[ia], a.data[ia + 1], a.data[ia + 2]) - Math.min(a.data[ia], a.data[ia + 1], a.data[ia + 2])
    const chb = Math.max(b.data[ib], b.data[ib + 1], b.data[ib + 2]) - Math.min(b.data[ib], b.data[ib + 1], b.data[ib + 2])
    sc += Math.abs(cha - chb)
  }
  for (let y = 1; y < a.h; y++) for (let x = 1; x < a.w; x++) {
    const i = y * a.w + x
    const ga = Math.abs(La[i] - La[i - 1]) + Math.abs(La[i] - La[i - a.w])
    const gb = Math.abs(Lb[i] - Lb[i - 1]) + Math.abs(Lb[i] - Lb[i - a.w])
    sg += Math.abs(ga - gb)
  }
  return {
    moy: +(sd / n).toFixed(4),
    grad: +(sg / ((a.h - 1) * (a.w - 1))).toFixed(4),
    chroma: +(sc / n).toFixed(4),
    pctBouges: +(100 * bouges / n).toFixed(3),
    pixels: n,
  }
}

const puppeteer = await chargerPuppeteer()
const nav = await puppeteer.launch({
  executablePath: 'C:/Program Files/Google/Chrome/Application/chrome.exe',
  headless: true,
  args: ['--headless=new', '--no-sandbox', '--enable-unsafe-swiftshader', '--window-size=1280,900'],
})
const out = { port: PORT, orbite: ORBITE, quand: new Date().toISOString(), lignes: [] }
try {
  const page = await nav.newPage()
  // ⛔ **UN NUANCEUR QUI NE SE LIE PAS EST INVISIBLE POUR UN BANC DIFFERENTIEL,
  // ET CE BANC S'EST FAIT PRENDRE.** Une premiere passe de cette tache a
  // redeclare `mnHash`/`mnNoise` que `globe.js` portait deja : le fragment
  // refusait de se lier, plus une tuile ne se dessinait — et les DIX-SEPT images
  // s'ecartaient alors de 0,12 a 0,33, c'est-a-dire du bruit. Le banc a lu
  // « aucune vignette n'agit » la ou il fallait lire « la Terre a disparu ».
  // La console, elle, le disait en toutes lettres. Elle est donc surveillee ICI.
  const erreursGL = []
  page.on('console', (m) => { const t = m.text(); if (/Shader Error|not compiled|VALIDATE_STATUS false|ERROR: 0:/.test(t)) erreursGL.push(t.slice(0, 600)) })
  page.on('pageerror', (e) => erreursGL.push('PAGEERROR ' + e.message.slice(0, 400)))
  await page.setViewport({ width: 1280, height: 800 })
  await page.evaluateOnNewDocument(() => { try { localStorage.setItem('shibumap-ui-advanced', '1') } catch {} })
  await page.goto(`http://localhost:${PORT}/`, { waitUntil: 'domcontentloaded', timeout: 180000 })
  await page.waitForFunction(() => window.__exp?.composer, { timeout: 180000, polling: 200 })
  await dodo(22000)
  await page.keyboard.press('Escape')
  await page.evaluate(() => { const e = window.__exp; e.params.animations = false; e.params.paused = true })
  if (ORBITE) { await page.evaluate(() => window.__exp.modes.enterOrbit()); await dodo(12000) }
  await dodo(4000)

  out.palier = await page.evaluate(() => {
    const p = window.__palierMachine
    return p ? { niveau: p.niveau ?? null, ombres: p.reglages?.ombres ?? null, grain: p.reglages?.grain ?? null, nuages: p.reglages?.nuages ?? null, ecran: p.signaux?.ecran ?? null } : null
  })
  out.etat = await page.evaluate(() => {
    const e = window.__exp
    return { crop: !!e.globe?._crop, mode: e.modes?.mode ?? null, mat: e.params.terrainSurfaceMat, visibleSocle: !!e.terrain?.mesh?.visible }
  })

  // la liste des tuiles, lue dans le DOM du picker DE LA MATIÈRE (pas celui des FX)
  const tuiles = await page.evaluate(() => {
    const picks = [...document.querySelectorAll('.ce-mat-pick')]
    const p = picks.find((n) => [...n.querySelectorAll('.ce-mat-vig')].some((b) => b.getAttribute('data-tip') === 'Verre'))
    if (!p) return null
    return [...p.querySelectorAll('.ce-mat-vig')].map((b, i) => ({ i, tip: b.getAttribute('data-tip') }))
  })
  if (!tuiles) throw new Error('picker de matière introuvable dans le DOM')
  out.nbTuiles = tuiles.length
  console.log('tuiles trouvées :', tuiles.length, tuiles.map((t) => t.tip).join(' · '))

  const clique = (i) => page.evaluate((k) => {
    const picks = [...document.querySelectorAll('.ce-mat-pick')]
    const p = picks.find((n) => [...n.querySelectorAll('.ce-mat-vig')].some((b) => b.getAttribute('data-tip') === 'Verre'))
    p.querySelectorAll('.ce-mat-vig')[k].click()
  }, i)

  const tire = async (nom) => {
    await page.evaluate(() => { const e = window.__exp; for (let i = 0; i < 3; i++) e.composer.render(0) })
    const buf = await page.screenshot({ type: 'png' })
    if (GARDE_PNG) fs.writeFileSync(path.join(SORTIE, `${nom}.png`), buf)
    return lirePng(buf)
  }

  // référence : la tuile « Aucune » (index 0)
  await clique(0); await dodo(2500)
  const ref = await tire('00-aucune')
  out.reference = { w: ref.w, h: ref.h }

  for (const t of tuiles) {
    await clique(t.i)
    await dodo(t.i === 0 ? 2500 : 5200) // le temps que les JPEG PBR arrivent
    const im = await tire(String(t.i).padStart(2, '0') + '-' + t.tip.replace(/[^a-zA-Z0-9]+/g, '_'))
    const etat = await page.evaluate(() => {
      const e = window.__exp
      const m = e.terrain.material
      return {
        id: e.params.terrainSurfaceMat,
        mode: e.terrain.materialMode,
        couleurMat: '#' + m.color.getHexString(),
        aMap: !!m.map, aNormal: !!m.normalMap, aRough: !!m.roughnessMap,
        rug: +m.roughness.toFixed(3), metal: +m.metalness.toFixed(3),
        uTint: e.terrain.mapUniforms.uTint.value,
        uMatSSS: e.terrain.mapUniforms.uMatSSS?.value ?? null,
        gAlbedo: e.globe.uniforms.uAlbedoBase.value.toArray().map((v) => +v.toFixed(4)),
        gTeinte: e.globe.uniforms.uAlbedoTeinte.value,
        gMatOn: e.globe.uniforms.uMatOn ? e.globe.uniforms.uMatOn.value : null,
      }
    })
    const c = compare(ref, im)
    out.lignes.push({ i: t.i, tip: t.tip, ...c, etat })
    console.log(String(t.i).padStart(2), t.tip.padEnd(16), 'moy', String(c.moy).padStart(8), 'grad', String(c.grad).padStart(8), 'chroma', String(c.chroma).padStart(7), '%', c.pctBouges, JSON.stringify(etat.gAlbedo), 'tint', etat.gTeinte)
  }
  out.erreursGL = erreursGL
  // ⚠️ PAS DE SEQUENCE D'ECHAPPEMENT ICI, ET C'EST UNE CICATRICE : le heredoc de
  // mon script d'edition a mange un niveau de contre-obliques, et le « \n » que
  // j'avais ecrit est arrive dans le fichier en RETOUR A LA LIGNE VERITABLE —
  // donc une chaine non terminee, donc un script mort. C'est le cousin exact de
  // l'incident du « \b » devenu un retour arriere, consigne au plan de fusion.
  // On joint avec un separateur LITTERAL.
  if (erreursGL.length) console.log('⛔ ERREURS DE NUANCEUR — LE RELEVE NE VAUT RIEN : ' + erreursGL.slice(0, 3).join(' || '))
  fs.writeFileSync(path.join(SORTIE, (ORBITE ? 'orbite' : 'crop') + '.json'), JSON.stringify(out, null, 2))
  console.log('→', path.join(SORTIE, (ORBITE ? 'orbite' : 'crop') + '.json'))
} finally {
  await nav.close()
}
