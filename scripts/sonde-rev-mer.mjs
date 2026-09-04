// SONDE REV — LA MER ET LES EFFETS DE PART ET D'AUTRE DU SEUIL z10 (D23 ②),
// MESURÉS À L'ÉCRAN, AVEC DE VRAIS GESTES.
//
// ══════════ POURQUOI UNE SONDE DE PLUS ═════════════════════════════════════
//
// `profil-pf3.mjs` sait déjà lire le régime (mer, occlusion, grain, profondeur
// de champ, tuiles). ⛔ **Mais son poste « surface » PLACE LA CAMÉRA EN
// ÉCRIVANT SA POSITION**, sans geste — donc **sans intention de sortie**. Sous
// D21 ①, le crop y SURVIT : relevé à 130 km, `pose: true`, `mer: true`,
// `ao: true`, **1 700 tuiles**. Ce n'est pas un défaut du prédicat, c'est D21 ①
// qui fonctionne ; mais ça ne mesure PAS « hors crop ».
//
// ⚡ **CETTE SONDE SORT DU CROP COMME L'UTILISATEUR** : un dézoom à la molette,
// qui ARME l'intention (D21 ①) et laisse le seuil TRANCHER (C1). Elle relève
// alors les deux régimes à la MÊME session, et la ligne de partage en mètres.
//
// ⚠️ **ELLE ATTEND LA FIN DU VOL DE DÉMARRAGE** (immobile 1,5 s et `d > 100`,
// puis `elementFromPoint` doit rendre le `CANVAS`). La pose de démarrage tombe
// entre 30,7 et 33,6 km, c'est-à-dire **à cheval sur le seuil z10 que D23
// remet** : mesurer avant, c'est mesurer un crop qui n'est peut-être pas né.
//
// ⚠️ **UN GESTE PAR CHARGEMENT N'EST PAS EXIGIBLE ICI**, et c'est délibéré :
// on ne mesure pas l'effet d'UN geste sur la caméra (là, enchaîner fausserait
// la somme) mais **l'ÉTAT DU COMPOSITEUR de part et d'autre d'une frontière**.
// La descente et la remontée sont donc jouées dans la même session, et c'est le
// nombre de CHARGEMENTS (8) qui porte la reproductibilité.
//
// EMPLOI
//   npm run dev -- --host 127.0.0.1 --port 7731 --strictPort
//   node scripts/sonde-rev-mer.mjs --port 7731 --charges 8

import fs from 'node:fs'
import path from 'node:path'
import { fileURLToPath } from 'node:url'

const RACINE = path.dirname(path.dirname(fileURLToPath(import.meta.url)))
const A = process.argv.slice(2)
const opt = (n, d) => { const i = A.indexOf(n); return i >= 0 && A[i + 1] !== undefined ? A[i + 1] : d }
const PORT = Number(opt('--port', '7731'))
const CHARGES = Number(opt('--charges', '8'))
const LIEU = opt('--lieu', '-21.1,55.5,12').split(',').map(Number)
const SORTIE = opt('--sortie', path.join(RACINE, '.banc', 'REV', 'mer-effets.json'))
const W = 1280, H = 800
const CX = W / 2, CY = H / 2

const CANDIDATS = [
  path.join(RACINE, 'node_modules/puppeteer-core/lib/puppeteer/puppeteer-core.js'),
  'C:/Dev/wt-f3/node_modules/puppeteer-core/lib/puppeteer/puppeteer-core.js',
  'C:/Dev/wt-warm/node_modules/puppeteer-core/lib/puppeteer/puppeteer-core.js',
].find((p) => fs.existsSync(p))
if (!CANDIDATS) { console.error('puppeteer-core absent'); process.exit(2) }
const pup = (await import('file:///' + CANDIDATS.split('\\').join('/'))).default

const CHROME = ['C:/Program Files/Google/Chrome/Application/chrome.exe',
  'C:/Program Files (x86)/Google/Chrome/Application/chrome.exe'].find((p) => fs.existsSync(p))

// ⛔ **CE NAVIGATEUR EST À MOI, ET IL EST FERMÉ EN PARTANT.** On ne touche
// jamais à un Chrome qu'on n'a pas lancé (règle du chantier).
const nav = await pup.launch({
  executablePath: CHROME, headless: 'new', protocolTimeout: 300000,
  args: ['--headless=new', '--no-sandbox', '--hide-scrollbars', '--mute-audio',
    `--window-size=${W},${H + 100}`, '--disable-frame-rate-limit', '--disable-gpu-vsync',
    '--use-angle=d3d11', '--enable-gpu', '--ignore-gpu-blocklist', '--disable-dev-shm-usage'],
})
const dodo = (ms) => new Promise((r) => setTimeout(r, ms))
const T0 = Date.now()
const etape = (m) => console.log(`[${((Date.now() - T0) / 1000).toFixed(0)} s] ${m}`)

let page, cdp
async function pageNeuve() {
  try { await page?.close() } catch { /* déjà fermée */ }
  page = await nav.newPage()
  await page.setViewport({ width: W, height: H, deviceScaleFactor: 1 })
  cdp = await page.target().createCDPSession()
}
const wait = (n) => page.evaluate((k) => new Promise((r) => { let i = 0; const t = () => (++i >= k ? r() : requestAnimationFrame(t)); requestAnimationFrame(t) }), n)

const souris = (type, x, y, button, buttons, extra = {}) =>
  cdp.send('Input.dispatchMouseEvent', { type, x, y, button, buttons, clickCount: 0, ...extra })
const cran = (delta, x = CX, y = CY) =>
  souris('mouseWheel', x, y, 'none', 0, { deltaX: 0, deltaY: delta })

// ══════════ CE QU'ON RELÈVE — le régime du compositeur, en une image ═══════
//
// ⚠️ **`_mer` EST LA MER SIMULÉE ELLE-MÊME**, pas un interrupteur : hors crop
// la calotte n'existe pas (`poserMer` / `retirerMer`), donc houle, écume et
// réfraction n'ont aucun maillage sur quoi tourner. `_merRefractRT` est la
// cible de rendu du grab pass de réfraction — le témoin le plus direct.
const ETAT = () => page.evaluate(() => {
  const e = window.__exp, g = e.globe
  const passes = e.composer?.passes ?? []
  const ao = passes.find((p) => p.configuration && p.configuration.aoRadius !== undefined)
  const dof = passes.find((p) => p.effects && p.effects.some((f) => f.constructor.name === 'DepthOfFieldEffect'))
  const fx = passes.find((p) => p.effects && p.effects.some((f) => f.constructor.name === 'NoiseEffect'))
  const grain = fx && fx.effects.find((f) => f.constructor.name === 'NoiseEffect')
  return {
    mode: e.modes.mode,
    altCadrageM: e.modes.mode === 'orbital' ? e.modes.altM : (e.altitudeCadrageM?.() ?? e.modes.altM),
    cropPose: !!e.veilleCrop?.pose,
    dedansCrop: typeof e.dedansCrop === 'function' ? !!e.dedansCrop() : null,
    auBloc: !!e.veilleCrop?.auBloc,
    crop: !!g?._crop,
    mer: !!g?._mer,
    merRefract: !!g?._merRefractRT,
    uCropOn: g?.uniforms?.uCropOn?.value ?? null,
    ao: ao ? !!ao.enabled : null,
    dof: dof ? !!dof.enabled : null,
    grain: grain ? grain.blendMode.opacity.value : null,
    grainVoulu: e.params?.grain ?? null,
    ssaoVoulu: !!e.params?.ssaoEnabled,
    tuiles: g?.tiles?.size ?? null,
  }
})

// ══════════ ALLUMER LES EFFETS COMME L'UTILISATEUR ═════════════════════════
//
// ⚠️ **SANS ÇA, LA MESURE NE PROUVE RIEN** : l'occlusion ambiante n'est BÂTIE
// qu'à la demande (`assureAoPass`) et la passe de profondeur de champ n'existe
// que si l'utilisateur a coché la case. Un relevé « ao: null, dof: null » des
// deux côtés du seuil dirait seulement qu'on n'a rien allumé — pas que le
// prédicat range bien les effets. On prend donc les mêmes portes que le
// panneau, à l'identique de `profil-pf3.mjs` (`allumerEffets`).
async function allumerEffets() {
  await page.evaluate(() => {
    const e = window.__exp
    e.params.ssaoEnabled = true
    e.params.grain = 0.2
    const fx = e.composer.passes.find((p) => p.effects && p.effects.some((f) => f.constructor.name === 'NoiseEffect'))
    const grain = fx && fx.effects.find((f) => f.constructor.name === 'NoiseEffect')
    if (grain) grain.blendMode.opacity.value = 0.2
    e.params.bokehScale = 4
    e.params.autoFocus = false
    // ⚠️ la bascule bokeh de l'interface est le SEUL chemin qui bâtisse la
    // passe ; elle INVERSE la valeur courante, donc on ne pose pas
    // `bokehEnabled` avant de cliquer.
    const lab = [...document.querySelectorAll('label')].find((x) => /bokeh/i.test(x.textContent || ''))
    const btn = lab?.parentElement?.querySelector('button.ce-toggle')
    if (btn && !e.params.bokehEnabled) btn.click()
    const passeDof = e.composer.passes.find((p) => p.effects && p.effects.some((x) => x.constructor.name === 'DepthOfFieldEffect'))
    const dof = passeDof && passeDof.effects.find((x) => x.constructor.name === 'DepthOfFieldEffect')
    if (dof) dof.bokehScale = 4
    if (typeof e.poserRegimeCrop === 'function') e.poserRegimeCrop()
  })
  await wait(4)
}

async function reposer() {
  await page.waitForFunction(
    '(window.__exp.modes.mode === "orbital" ? true : window.__exp.modes._zoomVel === 0) && !window.__exp.modes.busy && !window.__exp.modes._fonduPose',
    { timeout: 30000, polling: 'raf' },
  ).catch(() => etape('  (reposer : delai depasse)'))
  await wait(6)
}

async function neuf() {
  await pageNeuve()
  await page.goto(`http://127.0.0.1:${PORT}/`, { waitUntil: 'domcontentloaded', timeout: 90000 })
  await page.waitForFunction('!!(window.__exp && window.__exp.controls && window.__exp.modes)', { timeout: 120000 })
  await page.waitForFunction("!!document.getElementById('loading')?.classList.contains('hidden')", { timeout: 180000 })
  // ⚠️ LE VOL DE DÉMARRAGE DOIT ÊTRE FINI — voir l'en-tête : sa pose tombe à
  // cheval sur le seuil z10, et mesurer avant rend un faux constat une fois
  // sur deux.
  await page.waitForFunction(() => {
    const e = window.__exp
    const d = e.camera.position.distanceTo(e.controls.target)
    const R = (window.__stab ??= { d: NaN, t: 0 })
    if (Math.abs(d - R.d) > 1e-4) { R.d = d; R.t = performance.now(); return false }
    return d > 100 && !e.modes.busy && performance.now() - R.t > 1500
  }, { timeout: 90000, polling: 100 })
  // ⚠️ LE VOILE `.ce-elemwrap` AVALE LES GESTES : on exige le CANVAS sous le
  // curseur avant de toucher la molette.
  let sous = null
  for (let k = 0; k < 10; k++) {
    await page.keyboard.press('Escape').catch(() => {})
    await dodo(250)
    sous = await page.evaluate(() => document.elementFromPoint(640, 400)?.tagName ?? null)
    if (sous === 'CANVAS') break
  }
  if (sous !== 'CANVAS') throw new Error(`voile non ferme : elementFromPoint rend ${sous}`)
}

// descend jusqu'au bloc par un vol, puis attend que la vue soit VRAIMENT posée
async function allerAuBloc() {
  const [lat, lon, z] = LIEU
  await page.evaluate(([a, b, c]) => { Promise.resolve(window.__exp.modes.flyTo(a, b, c)).catch(() => {}) }, [lat, lon, z])
  await dodo(1500)
  await page.waitForFunction(() => {
    const e = window.__exp
    return !(e.modes.busy || e.modes.travel || e.modes._diveTween || e.tween?.active)
  }, { timeout: 180000, polling: 300 }).catch(() => etape('  (vol : delai)'))
  await page.waitForFunction(() => !!window.__exp.veilleCrop?.pose, { timeout: 90000, polling: 300 })
    .catch(() => etape('  (crop non pose)'))
  // l'arrivée sur le bloc anime encore (la pente de D16 ter) : on attend que
  // l'inclinaison ET l'altitude soient stables 2,4 s de suite
  let stable = 0, prev = null
  for (let i = 0; i < 200 && stable < 6; i++) {
    const s = await page.evaluate(() => {
      const e = window.__exp
      return { t: e.inclinaisonCouranteDeg?.() ?? 0, a: e.altitudeCadrageM?.() ?? 0 }
    })
    if (prev && Math.abs(s.t - prev.t) < 0.005 && Math.abs(s.a - prev.a) < 0.5) stable++
    else stable = 0
    prev = s
    await dodo(400)
  }
  await reposer()
  await dodo(400)
}

// ══════════ LE DÉZOOM MOLETTE, CRAN PAR CRAN — la sortie de D21 ① ═════════
//
// ⚠️ **UN CRAN, UNE LECTURE.** On ne saute pas au-dessus du seuil : on veut la
// ligne de partage EN MÈTRES, et l'image d'avant et d'après.
async function dezoomerJusquASortie(maxCrans = 260) {
  const crans = []
  let avant = await ETAT()
  for (let i = 0; i < maxCrans; i++) {
    await cran(120) // molette vers le bas = dézoom
    await wait(2)
    const s = await ETAT()
    crans.push({ cran: i + 1, altCadrageM: Math.round(s.altCadrageM), cropPose: s.cropPose, mer: s.mer })
    if (!s.cropPose) return { sorti: true, cranSortie: i + 1, avant, apres: s, crans }
    avant = s
  }
  return { sorti: false, cranSortie: null, avant, apres: await ETAT(), crans }
}

async function zoomerJusquANaissance(maxCrans = 260) {
  const crans = []
  for (let i = 0; i < maxCrans; i++) {
    await cran(-120)
    await wait(2)
    const s = await ETAT()
    crans.push({ cran: i + 1, altCadrageM: Math.round(s.altCadrageM), cropPose: s.cropPose, mer: s.mer })
    if (s.cropPose) {
      // ⚠️ **NE PAS LIRE LA MER SUR L'IMAGE OÙ LE CROP NAÎT.** La chaîne
      // (`crop`, `fond`, `parois`, `habillage`, `rampe`, `mer`) est posée à la
      // suite de la bascule, pas dans la même image : un relevé pris là rend
      // `mer: false` avec `cropPose: true`, ce qui ressemble trait pour trait à
      // un défaut du prédicat. Relevé, puis réfuté en laissant la chaîne finir.
      // ⚠️ **NE PAS LIRE LA MER SUR L'IMAGE OÙ LE CROP NAÎT** (voir plus bas) :
      // on ATTEND qu'elle arrive, et on chronomètre l'attente — un « mer:
      // false » à la bascule ressemble à un défaut du prédicat et n'en est pas.
      await reposer()
      const t0 = Date.now()
      let etat = await ETAT()
      for (let k = 0; k < 60 && !etat.mer; k++) { await dodo(250); etat = await ETAT() }
      return { ne: true, cranNaissance: i + 1, etatBascule: s, etat, merApresMs: Date.now() - t0, crans }
    }
  }
  return { ne: false, cranNaissance: null, etat: await ETAT(), crans }
}

// ══════════ LA CAMPAGNE ════════════════════════════════════════════════════
const R = { quand: new Date().toISOString(), port: PORT, lieu: LIEU, charges: [] }
for (let c = 0; c < CHARGES; c++) {
  let ok = false
  for (let essai = 0; essai < 3 && !ok; essai++) {
    try {
      etape(`chargement ${c + 1}/${CHARGES} (essai ${essai + 1})`)
      await neuf()
      await allerAuBloc()
      await allumerEffets()
      const dansLeCrop = await ETAT()
      etape(`  dans le crop : alt ${Math.round(dansLeCrop.altCadrageM)} m · mer ${dansLeCrop.mer} · ao ${dansLeCrop.ao} · grain ${dansLeCrop.grain} · dof ${dansLeCrop.dof} · tuiles ${dansLeCrop.tuiles}`)
      const sortie = await dezoomerJusquASortie()
      const horsDuCrop = sortie.apres
      etape(`  hors du crop : alt ${Math.round(horsDuCrop.altCadrageM)} m (cran ${sortie.cranSortie}) · mer ${horsDuCrop.mer} · ao ${horsDuCrop.ao} · grain ${horsDuCrop.grain} · dof ${horsDuCrop.dof} · tuiles ${horsDuCrop.tuiles}`)
      const naissance = await zoomerJusquANaissance()
      etape(`  renaissance : alt ${Math.round(naissance.etat.altCadrageM)} m (cran ${naissance.cranNaissance}) · mer ${naissance.etat.mer} apres ${naissance.merApresMs} ms · ao ${naissance.etat.ao} · grain ${naissance.etat.grain}`)
      R.charges.push({ n: c + 1, dansLeCrop, sortie, horsDuCrop, naissance })
      ok = true
    } catch (err) {
      etape(`  rate : ${String(err.message).slice(0, 120)}`)
    }
  }
  if (!ok) R.charges.push({ n: c + 1, echec: true })
}
try { await page?.close() } catch { /* déjà fermée */ }
await nav.close()

fs.mkdirSync(path.dirname(SORTIE), { recursive: true })
fs.writeFileSync(SORTIE, JSON.stringify(R, null, 2))

// ══════════ LE VERDICT ═════════════════════════════════════════════════════
const bons = R.charges.filter((x) => !x.echec)
const n = bons.length
const compte = (f) => bons.filter(f).length
const plage = (f) => {
  const v = bons.map(f).filter((x) => Number.isFinite(x))
  return v.length ? `${Math.round(Math.min(...v))} – ${Math.round(Math.max(...v))} m` : '—'
}
console.log(`\n══ SONDE REV — mer et effets de part et d'autre du seuil z10 (${n}/${CHARGES} chargements)\n`)
console.log('| grandeur | DANS le crop | HORS du crop | attendu |')
console.log('|---|---|---|---|')
console.log(`| altitude de cadrage | ${plage((x) => x.dansLeCrop.altCadrageM)} | ${plage((x) => x.horsDuCrop.altCadrageM)} | seuil 32 274 / mort 40 343 |`)
console.log(`| \`cropPose\` | ${compte((x) => x.dansLeCrop.cropPose)}/${n} vrai | ${compte((x) => !x.horsDuCrop.cropPose)}/${n} faux | vrai / faux |`)
console.log(`| **mer simulée** (\`globe._mer\`) | ${compte((x) => x.dansLeCrop.mer)}/${n} allumée | ${compte((x) => !x.horsDuCrop.mer)}/${n} éteinte | allumée / éteinte |`)
console.log(`| réfraction (\`_merRefractRT\`) | ${compte((x) => x.dansLeCrop.merRefract)}/${n} | ${compte((x) => !x.horsDuCrop.merRefract)}/${n} éteinte | allumée / éteinte |`)
console.log(`| occlusion ambiante | ${compte((x) => x.dansLeCrop.ao)}/${n} allumée | ${compte((x) => !x.horsDuCrop.ao)}/${n} éteinte | allumée / éteinte |`)
console.log(`| grain | ${compte((x) => x.dansLeCrop.grain > 0)}/${n} > 0 | ${compte((x) => x.horsDuCrop.grain === 0)}/${n} = 0 | voulu / 0 |`)
console.log(`| **profondeur de champ (D20)** | ${compte((x) => x.dansLeCrop.dof)}/${n} | ${compte((x) => x.horsDuCrop.dof)}/${n} | **allumée DES DEUX CÔTÉS** |`)
console.log(`| tuiles | ${plage((x) => x.dansLeCrop.tuiles)} | ${plage((x) => x.horsDuCrop.tuiles)} | — |`)
console.log(`\ncran de sortie : ${bons.map((x) => x.sortie.cranSortie).join(', ')}`)
console.log(`cran de renaissance : ${bons.map((x) => x.naissance.cranNaissance).join(', ')}`)
console.log(`altitude de renaissance : ${plage((x) => x.naissance.etat.altCadrageM)}`)
console.log(`mer revenue apres la renaissance : ${bons.map((x) => x.naissance.merApresMs).join(', ')} ms — ${compte((x) => x.naissance.etat.mer)}/${n} allumee`)
console.log(`\nécrit : ${SORTIE}`)
