// SONDE R21 bis — CHASSER LE TRANSITOIRE DU BANC, PAR L'ÉTAT ET PAS PAR LES PIXELS
//
// ⛔ **R21 A NOMMÉ UN TRANSITOIRE SANS SAVOIR LE REPRODUIRE.** Un écart d'environ
// 0,17 de moyenne et 0,33 de gradient, une mesure sur douze, signature constante
// (valeur basse exactement 0,000, `dRetour` exactement 0). Il a frappé le n° 68,
// puis l'état AVANT du n° 73, puis **le témoin nul lui-même** — qui ne touche
// aucun contrôle. R21 a écarté PAR LECTURE la rotation propre, le mouvement
// ambiant, les tuiles en vol et les gestes d'interface, et s'est arrêtée là.
//
// ⚠️ **LA RÈGLE DU CHANTIER : ne pas nommer une cause qu'on n'a pas reproduite.**
// Une explication qui réconcilie deux mesures sans avoir été vérifiée clôt le
// débat en laissant l'erreur dedans — le dépôt a déjà payé ça avec un champ de
// vision qui « expliquait » trois plafonds de zoom alors que `grep -ic fov`
// rendait zéro.
//
// ⚡ **D'OÙ CE BANC : IL NE MESURE PAS QUE L'IMAGE, IL PHOTOGRAPHIE L'ÉTAT.** À
// chaque passe il relève, dans le MÊME instant que le condensé : la pose de la
// caméra au millionième, le palier machine, le rapport de pixels, le grain,
// l'état de chaque passe du compositeur, le compte de tuiles par état, l'heure,
// et une vingtaine d'uniformes. Quand l'écart apparaît, le banc DIFFÉRENCIE les
// deux états et nomme ce qui a bougé. Si rien n'a bougé dans la liste, c'est un
// résultat aussi : la liste est incomplète, et il faut le dire.
//
// ⚠️ **DEUX MODES, ET LE SECOND EXISTE PARCE QUE LE PREMIER A RENDU ZÉRO.**
//
//   · **`--suivi` (défaut)** — une seule page, aucun rechargement, aucun geste,
//     N relevés du MÊME état. ⛔ **90 passes, 0 écart, `moy = 0` et `grad = 0`
//     à chaque ligne.** Le transitoire **n'existe pas** dans une page qui vit.
//     C'est un résultat, et il élimine d'un coup tout ce qui tourne en régime :
//     le grain, l'exposition, un palier qui oscillerait, une dérive de caméra.
//
//   · **`--recharge`** — chaque passe RECHARGE la page, attend, puis rejoue le
//     protocole du témoin nul de R21 : quatre relevés espacés. ⚡ **C'est la
//     seule différence entre les deux bancs**, et c'est donc là que le
//     transitoire se cache : dans ce qui n'a pas fini de se poser après un
//     chargement, et que l'attente des tuiles ne couvre pas.
import fs from 'node:fs'
import path from 'node:path'
import { fileURLToPath } from 'node:url'

const RACINE = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..')
const args = process.argv.slice(2)
const opt = (n, d = null) => { const i = args.indexOf(n); return i >= 0 && args[i + 1] ? args[i + 1] : d }
const has = (n) => args.includes(n)
const PORT = Number(opt('--port', '5603'))
const SORTIE = opt('--sortie', path.join(RACINE, '.banc/R21bis'))
const PASSES = Number(opt('--passes', '80'))
const ENTRE_MS = Number(opt('--entre', '1400'))
const IMAGES = Number(opt('--images', '6'))
const SEUIL = Number(opt('--seuil', '0.03'))
const VISIBLE = has('--visible')
const ETIQ = opt('--etiquette', 'transitoire')
const RECHARGE = has('--recharge')
const REPOS = Number(opt('--repos', '900'))
// ⚡ **LE BRAS TÉMOIN DE L'EXPÉRIENCE.** La chasse 2 a montré que la porte des
// tuiles **EXPIRE À CHAQUE FOIS** — 45 002 ms, et il reste 4 à 9 tuiles en
// `loading`/`empty` en permanence. La sonde attendait donc 45 s de plus que ce
// que son auteur croyait, et mesurait une scène BEAUCOUP plus posée que celle
// des bancs d'origine. `--sans-porte` retire cette attente : c'est la seule
// variable qui change entre les deux bras.
const SANS_PORTE = has('--sans-porte')
// ══════════ ⚡ LE BRAS QUI ACCUSE — `--charge` ══════════════════════════════
//
// Les chasses 1 à 3 ont rendu **0 écart sur 144 passes**, sur une machine
// OISIVE. Or les campagnes de R21 tournaient pendant que la même machine
// exécutait `npm test`, des éditions de sources et d'autres sondes.
//
// ⚡ **ET LE DÉPÔT A UN GOUVERNEUR QUI RÉAGIT À LA CHARGE** : `src/perf.js`
// descend d'un palier après **2,5 s sous 30 images/s** (`DOWN_SUSTAIN`), et
// remonte après **12 s au-dessus de 55** (`UP_SUSTAIN`). `applyTier` change
// alors les ombres, le grain, le rapport de pixels et les effets — **d'un
// coup** —, et `announce()` affiche « PERFORMANCE — … », la bannière que le
// coordinateur a vue.
//
// ⛔ **ON NE L'APPELLE PAS À LA MAIN.** `setTier` n'est pas exposé, et c'est
// tant mieux : le prouver en appelant l'interne prouverait qu'un interne change
// l'image, pas que le gouverneur se déclenche tout seul. On ralentit donc le
// PROCESSEUR par CDP (`Emulation.setCPUThrottlingRate`), on relâche, et on
// regarde si le gouverneur a bougé de lui-même — puis si l'image revient.
const CHARGE = has('--charge')
const CHARGE_TAUX = Number(opt('--taux', '8'))
const CHARGE_MS = Number(opt('--charge-ms', '6000'))
const RETOUR_MS = Number(opt('--retour-ms', '22000'))
const dodo = (ms) => new Promise((r) => setTimeout(r, ms))

function trouverChrome() {
  const donne = opt('--chrome', process.env.CHROME_PATH)
  if (donne) return donne
  const t = [
    'C:/Program Files/Google/Chrome/Application/chrome.exe',
    'C:/Program Files (x86)/Google/Chrome/Application/chrome.exe',
    '/usr/bin/google-chrome',
  ].find((p) => fs.existsSync(p))
  if (!t) { console.error('Chrome introuvable'); process.exit(2) }
  return t
}
async function chargerPuppeteer() {
  for (const p of [
    path.join(RACINE, 'node_modules/puppeteer-core/lib/puppeteer/puppeteer-core.js'),
    'C:/Dev/wt-f3/node_modules/puppeteer-core/lib/puppeteer/puppeteer-core.js',
    'C:/Dev/wt-warm/node_modules/puppeteer-core/lib/puppeteer/puppeteer-core.js',
  ]) if (fs.existsSync(p)) return (await import('file:///' + p.split('\\').join('/'))).default
  console.error('puppeteer-core introuvable')
  process.exit(2)
}

const LARG = 256
const HAUT = 160

// L'instrument de R18/R21, au mot près — condensé 256 × 160 + gradient local.
function poserInstrument(LARG, HAUT) {
  const e = window.__exp
  if (!e) return 'pas de __exp'
  if (window.__tr && window.__tr.capturer) return 'déjà posé'
  const R = e.renderer
  const gl = R.getContext()
  const CV = R.domElement
  const etages = []
  function construireEtages() {
    for (const f of etages) { gl.deleteFramebuffer(f.fbo); gl.deleteRenderbuffer(f.rb) }
    etages.length = 0
    let w = CV.width, h = CV.height
    for (let i = 0; i < 12; i++) {
      const nw = Math.max(LARG, w >> 1)
      const nh = Math.max(HAUT, h >> 1)
      const rb = gl.createRenderbuffer()
      gl.bindRenderbuffer(gl.RENDERBUFFER, rb)
      gl.renderbufferStorage(gl.RENDERBUFFER, gl.RGBA8, nw, nh)
      const fbo = gl.createFramebuffer()
      gl.bindFramebuffer(gl.FRAMEBUFFER, fbo)
      gl.framebufferRenderbuffer(gl.FRAMEBUFFER, gl.COLOR_ATTACHMENT0, gl.RENDERBUFFER, rb)
      etages.push({ fbo, rb, w: nw, h: nh })
      w = nw
      h = nh
      if (nw === LARG && nh === HAUT) break
    }
    gl.bindFramebuffer(gl.FRAMEBUFFER, null)
    gl.bindRenderbuffer(gl.RENDERBUFFER, null)
  }
  const px = new Uint8Array(LARG * HAUT * 4)
  function condense() {
    if (!etages.length || etages[0].w * 2 < CV.width) construireEtages()
    let srcFbo = null
    let sw = CV.width
    let sh = CV.height
    for (const et of etages) {
      gl.bindFramebuffer(gl.READ_FRAMEBUFFER, srcFbo)
      gl.bindFramebuffer(gl.DRAW_FRAMEBUFFER, et.fbo)
      gl.blitFramebuffer(0, 0, sw, sh, 0, 0, et.w, et.h, gl.COLOR_BUFFER_BIT, gl.LINEAR)
      srcFbo = et.fbo
      sw = et.w
      sh = et.h
    }
    gl.bindFramebuffer(gl.READ_FRAMEBUFFER, srcFbo)
    gl.readPixels(0, 0, LARG, HAUT, gl.RGBA, gl.UNSIGNED_BYTE, px)
    gl.bindFramebuffer(gl.READ_FRAMEBUFFER, null)
    gl.bindFramebuffer(gl.DRAW_FRAMEBUFFER, null)
    gl.bindFramebuffer(gl.FRAMEBUFFER, null)
    R.resetState?.()
    const t = new Array(LARG * HAUT * 3)
    for (let i = 0, j = 0; i < LARG * HAUT; i++) { t[j++] = px[i * 4]; t[j++] = px[i * 4 + 1]; t[j++] = px[i * 4 + 2] }
    return t
  }
  const N = LARG * HAUT * 3
  const etat = { n: 0, slots: {} }
  window.__tr = etat
  const tampon = []
  function gradientDe(moy) {
    const g = new Float32Array(LARG * HAUT)
    const lum = new Float32Array(LARG * HAUT)
    for (let i = 0; i < LARG * HAUT; i++) lum[i] = 0.299 * moy[i * 3] + 0.587 * moy[i * 3 + 1] + 0.114 * moy[i * 3 + 2]
    for (let y = 0; y < HAUT; y++) {
      for (let x = 0; x < LARG; x++) {
        const i = y * LARG + x
        const dx = x + 1 < LARG ? Math.abs(lum[i + 1] - lum[i]) : 0
        const dy = y + 1 < HAUT ? Math.abs(lum[i + LARG] - lum[i]) : 0
        g[i] = dx + dy
      }
    }
    return g
  }
  function boucle() {
    try {
      tampon.push(Float32Array.from(condense()))
      if (tampon.length > 24) tampon.shift()
      etat.n++
    } catch (err) { etat.erreur = String(err).slice(0, 120) }
    requestAnimationFrame(boucle)
  }
  etat.vider = () => { tampon.length = 0; etat.n = 0 }
  etat.pret = (k) => tampon.length >= k
  etat.capturer = (nom, k) => {
    const im = tampon.slice(-k)
    const moy = new Float32Array(N)
    for (const t of im) for (let i = 0; i < N; i++) moy[i] += t[i]
    for (let i = 0; i < N; i++) moy[i] /= im.length
    etat.slots[nom] = { moy, grad: gradientDe(moy) }
    return im.length
  }
  etat.distance = (a, b) => {
    const A = etat.slots[a]
    const B = etat.slots[b]
    if (!A || !B) return null
    let sm = 0
    let sg = 0
    let pire = 0
    for (let i = 0; i < N; i++) { const d = Math.abs(A.moy[i] - B.moy[i]); sm += d; if (d > pire) pire = d }
    for (let i = 0; i < LARG * HAUT; i++) sg += Math.abs(A.grad[i] - B.grad[i])
    // ⚡ **OÙ LES PIXELS CHANGENT, ET PAS SEULEMENT DE COMBIEN.** Un transitoire
    // GLOBAL (grain, palier, exposition, rapport de pixels) répand ses écarts
    // sur toute l'image ; un transitoire LOCAL (une tuile qui s'affine, le bloc)
    // les concentre dans une boîte. La grandeur sépare les deux familles AVANT
    // qu'on ait à deviner.
    let sx = 0
    let sy = 0
    let nn = 0
    let xmin = 1e9
    let xmax = -1
    let ymin = 1e9
    let ymax = -1
    for (let y = 0; y < HAUT; y++) {
      for (let x = 0; x < LARG; x++) {
        const j = (y * LARG + x) * 3
        const d = Math.abs(A.moy[j] - B.moy[j]) + Math.abs(A.moy[j + 1] - B.moy[j + 1]) + Math.abs(A.moy[j + 2] - B.moy[j + 2])
        if (d > 1.5) { sx += x; sy += y; nn++; if (x < xmin) xmin = x; if (x > xmax) xmax = x; if (y < ymin) ymin = y; if (y > ymax) ymax = y }
      }
    }
    return {
      moy: sm / N,
      grad: sg / (LARG * HAUT),
      pire,
      pixelsChanges: nn,
      partChangee: nn / (LARG * HAUT),
      centre: nn ? [+(sx / nn).toFixed(1), +(sy / nn).toFixed(1)] : null,
      boite: nn ? [xmin, ymin, xmax, ymax] : null,
    }
  }
  requestAnimationFrame(boucle)
  return 'posé'
}

// ══════════ LA PHOTOGRAPHIE DE L'ÉTAT — c'est elle qui nomme la cause ═══════
//
// ⚠️ **LA POSE DE LA CAMÉRA EST EN TÊTE, ET C'EST L'OUBLI DE R21.** Sur une scène
// figée, le premier suspect d'un écart d'image est la caméra — et R21 n'a jamais
// relevé sa position. Elle est ici au millionième, avec le quaternion, le champ
// de vision, la cible des contrôles et la caméra du bloc.
function photoEtat() {
  const e = window.__exp
  const r6 = (x) => (typeof x === 'number' && Number.isFinite(x) ? +x.toFixed(6) : x)
  const P = window.__palierMachine || {}
  const cam = e.camGlobe || e.camera
  const u = e.globe?.uniforms || {}
  const tuiles = { total: 0, loading: 0, empty: 0, prete: 0 }
  try {
    for (const v of e.globe.tiles.values()) {
      tuiles.total++
      if (v.state === 'loading') tuiles.loading++
      else if (v.state === 'empty') tuiles.empty++
      else tuiles.prete++
    }
  } catch {}
  const uni = {}
  for (const k of ['uSunDir', 'uSoleilDir', 'uHemiHaut', 'uSoleilIrr', 'uCielIrr', 'uSolIrr', 'uAppointIrr',
    'uNuitCarte', 'uEclairageOn', 'uAnalysisOn', 'uNormaleFineOn', 'uCropOn', 'uHabOn', 'uSlopeTint',
    'uEstompage', 'uEstompageOn', 'uHeightContrast', 'uHeightPivot', 'uAlbedoTeinte', 'uTexShade',
    'uGrainForceM', 'uMppFacteur', 'uUnitesParMetre', 'uContourOpacity', 'uContourInterval', 'uReliefMondeGain']) {
    const v = u[k]?.value
    if (v == null) continue
    uni[k] = typeof v === 'number' ? r6(v) : (v.x !== undefined ? [r6(v.x), r6(v.y), r6(v.z)] : String(v).slice(0, 30))
  }
  return {
    t: r6(performance.now()),
    cam: cam ? {
      p: [r6(cam.position.x), r6(cam.position.y), r6(cam.position.z)],
      q: [r6(cam.quaternion.x), r6(cam.quaternion.y), r6(cam.quaternion.z), r6(cam.quaternion.w)],
      fov: r6(cam.fov), zoom: r6(cam.zoom), near: r6(cam.near), far: r6(cam.far),
    } : null,
    camBloc: e.camera ? { p: [r6(e.camera.position.x), r6(e.camera.position.y), r6(e.camera.position.z)], fov: r6(e.camera.fov) } : null,
    cible: e.controls?.target ? [r6(e.controls.target.x), r6(e.controls.target.y), r6(e.controls.target.z)] : null,
    palier: { n: P.palier, nom: P.nom, ombres: P.ombres, ombresRes: P.ombresRes, densite: P.densite, grain: P.grain, dof: P.dof, ssao: P.ssao, charge: P.charge, mpxServis: P.mpxServis },
    pixelRatio: r6(e.renderer?.getPixelRatio?.()),
    canvas: [e.renderer.domElement.width, e.renderer.domElement.height],
    passes: (e.composer?.passes || []).map((p) => (p.constructor?.name || '?') + ':' + (p.enabled ? 1 : 0)).join('|'),
    mode: e.modes?.mode,
    busy: !!e.modes?.busy,
    altM: r6(e.modes?.altM),
    params: {
      grain: r6(e.params.grain), animations: e.params.animations, shadowMode: e.params.shadowMode,
      timeOfDay: r6(e.params.timeOfDay), ssaoEnabled: e.params.ssaoEnabled, dofEnabled: e.params.dofEnabled,
      exposure: r6(e.params.exposure), demExaggeration: r6(e.params.demExaggeration),
      colorMode: e.params.colorMode, fillEnabled: e.params.fillEnabled, fillIntensity: r6(e.params.fillIntensity),
    },
    envIntensite: r6(e.scene?.environmentIntensity),
    sun: e.sun ? { i: r6(e.sun.intensity), c: e.sun.color.getHexString(), cast: e.sun.castShadow, radius: r6(e.sun.shadow?.radius), map: e.sun.shadow?.mapSize ? [e.sun.shadow.mapSize.width, e.sun.shadow.mapSize.height] : null } : null,
    toneMapping: e.renderer?.toneMapping,
    toneExpo: r6(e.renderer?.toneMappingExposure),
    tuiles,
    uni,
    // ⚠️ **LA BANNIÈRE DE PERFORMANCE** : le coordinateur l'a VUE s'afficher
    // pendant un chargement. Si elle apparaît dans la même passe que l'écart,
    // elle en est la cause ou la conséquence — dans les deux cas il faut le voir.
    banniere: (() => {
      const t = document.body.innerText || ''
      const m = t.match(/PERFORMANCE[^\n]{0,60}/i)
      return m ? m[0] : null
    })(),
    info: e.renderer?.info?.render ? { calls: e.renderer.info.render.calls, tris: e.renderer.info.render.triangles } : null,
    memo: performance.memory ? Math.round(performance.memory.usedJSHeapSize / 1048576) : null,
  }
}

const puppeteer = await chargerPuppeteer()
const nav = await puppeteer.launch({
  executablePath: trouverChrome(),
  headless: !VISIBLE,
  args: [...(VISIBLE ? [] : ['--headless=new']), '--no-sandbox', '--enable-unsafe-swiftshader', '--window-size=1280,900'],
})
fs.mkdirSync(SORTIE, { recursive: true })
const journal = { etiquette: ETIQ, port: PORT, passes: PASSES, entreMs: ENTRE_MS, images: IMAGES, seuil: SEUIL, lignes: [], evenements: [] }

try {
  const page = await nav.newPage()
  await page.setViewport({ width: 1280, height: 800 })
  const erreurs = []
  page.on('pageerror', (er) => erreurs.push(String(er.message).slice(0, 200)))
  await page.evaluateOnNewDocument(() => {
    try {
      localStorage.setItem('shibumap-ui-advanced', '1')
      localStorage.setItem('shibumap-workmode', 'studio')
    } catch {}
  })
  // ⛔ **ET ELLE N'EN EST PAS UNE — MESURÉ SUR 24 CHARGEMENTS.** Elle EXPIRE à
  // ses 45 s à chaque fois, et il reste 4 à 9 tuiles `empty` (jamais `loading`)
  // que rien ne remplira. Ce qu'elle fait réellement, c'est temporiser 45 s.
  // ⚠️ **LA PORTE DES TUILES EST JOURNALISÉE, PAS SEULEMENT ATTENDUE.** Elle est
  // enveloppée d'un `.catch()` : si elle EXPIRE, la sonde continue quand même,
  // sur une scène qui n'a pas fini de se poser — et personne ne le saurait. Ce
  // silence-là est exactement le genre de chose qui fabrique un transitoire.
  async function preparer() {
    const t0 = Date.now()
    await page.goto('http://localhost:' + PORT + '/', { waitUntil: 'domcontentloaded', timeout: 120000 })
    await page.waitForFunction(() => window.__exp?.modes && window.__exp?.globe && window.__exp?.composer, { timeout: 90000, polling: 100 })
    await dodo(9000)
    await page.keyboard.press('Escape')
    await dodo(3000)
    await page.evaluate(() => {
      for (const p of document.querySelectorAll('.ce-panel')) p.classList.remove('collapsed')
      for (const s of document.querySelectorAll('.ce-section')) s.classList.add('open')
      document.body.classList.add('ce-railL-off', 'ce-railR-off')
    })
    await dodo(1500)
    await page.evaluate(poserInstrument, LARG, HAUT)
    await page.evaluate(() => { window.__exp.params.animations = false })
    let porte = SANS_PORTE ? 'sautee' : 'ok'
    const tPorte = Date.now()
    if (!SANS_PORTE) await page.waitForFunction(() => {
      const t = window.__exp.globe?.tiles
      if (!t) return true
      let n = 0
      for (const v of t.values()) if (v.state === 'loading' || v.state === 'empty') n++
      return n === 0
    }, { polling: 250, timeout: 45000 }).catch(() => { porte = 'EXPIREE' })
    const msPorte = Date.now() - tPorte
    await dodo(4000)
    const restes = await page.evaluate(() => {
      const t = window.__exp.globe?.tiles
      let n = 0
      if (t) for (const v of t.values()) if (v.state === 'loading' || v.state === 'empty') n++
      return n
    })
    return { porte, msPorte, restes, msTotal: Date.now() - t0 }
  }
  let prep = await preparer()
  console.log('preparation : porte=' + prep.porte + ' en ' + prep.msPorte + ' ms, ' + prep.restes + ' tuile(s) restante(s)')

  const releve = async (nom) => {
    await page.evaluate(() => window.__tr.vider())
    await page.waitForFunction((n) => window.__tr.pret(n), { polling: 30, timeout: 45000 }, IMAGES)
    return page.evaluate((n, k) => window.__tr.capturer(n, k), nom, IMAGES)
  }
  const dist = (a, b) => page.evaluate((x, y) => window.__tr.distance(x, y), a, b)

  journal.gpu = await page.evaluate(() => {
    const gl = window.__exp?.renderer?.getContext?.()
    const d = gl?.getExtension('WEBGL_debug_renderer_info')
    return d ? String(gl.getParameter(d.UNMASKED_RENDERER_WEBGL)) : 'inconnu'
  })
  console.log('pilote :', journal.gpu)
  console.log('passes :', PASSES, '· intervalle', ENTRE_MS, 'ms · seuil', SEUIL)

  // ══════ LE DIFF D'ÉTAT, UTILISÉ PAR LES DEUX MODES ═══════════════════════
  const diffEtat = (a, b) => {
    const diff = []
    const parcours = (x, y, chemin) => {
      const cles = new Set([...Object.keys(x || {}), ...Object.keys(y || {})])
      for (const k of cles) {
        if (k === 't') continue
        const vx = x ? x[k] : undefined
        const vy = y ? y[k] : undefined
        if (vx && typeof vx === 'object' && vy && typeof vy === 'object' && !Array.isArray(vx)) { parcours(vx, vy, chemin + k + '.'); continue }
        const sx = JSON.stringify(vx)
        const sy = JSON.stringify(vy)
        if (sx !== sy) diff.push(chemin + k + ' : ' + sx + ' -> ' + sy)
      }
    }
    parcours(a, b, '')
    return diff
  }

  // ══════════ ⚡ MODE RECHARGE — LE PROTOCOLE DU TÉMOIN NUL DE R21 ═══════════
  //
  // ⚠️ **QUATRE RELEVÉS ESPACÉS APRÈS CHAQUE CHARGEMENT, ET UNE PHOTO D'ÉTAT À
  // CHACUN.** C'est exactement ce que faisait le témoin nul de R21 — le seul
  // banc où le transitoire s'est montré. La nouveauté n'est pas le protocole,
  // c'est qu'on relève l'ÉTAT à chaque relevé, donc qu'on peut dire ce qui a
  // bougé ENTRE deux d'entre eux.
  if (RECHARGE) {
    let nEvt = 0
    for (let i = 1; i <= PASSES; i++) {
      if (i > 1) prep = await preparer()
      const etats = []
      const noms = ['r1', 'r2', 'r3', 'r4']
      for (let k = 0; k < 4; k++) {
        if (k) await dodo(REPOS)
        await releve(noms[k])
        etats.push(await page.evaluate(photoEtat))
      }
      const d12 = await dist('r1', 'r2')
      const d13 = await dist('r1', 'r3')
      const d23 = await dist('r2', 'r3')
      const d14 = await dist('r1', 'r4')
      const moy = Math.max(d12.moy, d13.moy, d23.moy)
      const grad = Math.max(d12.grad, d13.grad, d23.grad)
      const moyMin = Math.min(d12.moy, d13.moy, d23.moy)
      // ⚠️ **LE DIFF D'ÉTAT EST RELEVÉ À CHAQUE PASSE, PAS SEULEMENT SUR ÉCART.**
      // Sans ça on ne voit ce qui bouge QUE quand l'image bouge — et on ne peut
      // pas dire si le transitoire est rare parce que la cause est rare, ou
      // parce que la cause est fréquente et n'a qu'une fois sur douze un effet
      // visible. Les deux appellent des réparations opposées.
      const bouge = [...diffEtat(etats[0], etats[1]), ...diffEtat(etats[1], etats[2]), ...diffEtat(etats[2], etats[3])]
      const ligne = {
        i, prep, moy: +moy.toFixed(4), grad: +grad.toFixed(4), moyMin: +moyMin.toFixed(4),
        dRetour: { moy: +d14.moy.toFixed(4), grad: +d14.grad.toFixed(4) },
        paires: { d12: +d12.moy.toFixed(4), d13: +d13.moy.toFixed(4), d23: +d23.moy.toFixed(4) },
        pixels: [d12.pixelsChanges, d13.pixelsChanges, d23.pixelsChanges],
        centre: d13.centre || d12.centre, boite: d13.boite || d12.boite,
        tuiles: etats.map((e) => e.tuiles.total + '/' + e.tuiles.loading + '/' + e.tuiles.empty),
        etatBouge: bouge,
      }
      journal.lignes.push(ligne)
      const chaud = moy > SEUIL || grad > SEUIL * 2
      if (chaud) {
        nEvt++
        const d1 = diffEtat(etats[0], etats[1])
        const d2 = diffEtat(etats[1], etats[2])
        const d3 = diffEtat(etats[2], etats[3])
        journal.evenements.push({ i, ...ligne, diff12: d1, diff23: d2, diff34: d3, etats })
        console.log('  ⚡ ECART passe ' + i + ' : moy=' + ligne.moy + ' grad=' + ligne.grad
          + ' (basse ' + ligne.moyMin + ') dRetour=' + ligne.dRetour.moy
          + ' paires=' + JSON.stringify(ligne.paires)
          + ' centre=' + JSON.stringify(ligne.centre) + ' boite=' + JSON.stringify(ligne.boite))
        for (const [nom, dd] of [['r1->r2', d1], ['r2->r3', d2], ['r3->r4', d3]]) {
          if (!dd.length) { console.log('     ' + nom + ' : rien'); continue }
          for (const l of dd) console.log('     ' + nom + ' : ' + l)
        }
        await page.screenshot({ path: path.join(SORTIE, ETIQ + '-ecart-' + String(i).padStart(3, '0') + '.png') })
      } else {
        console.log('  [' + i + '/' + PASSES + '] moy=' + ligne.moy + ' grad=' + ligne.grad
          + ' porte=' + prep.porte + '/' + prep.msPorte + 'ms restes=' + prep.restes
          + ' tuiles=' + ligne.tuiles.join(' ')
          + (bouge.length ? ' | ETAT BOUGE : ' + bouge.slice(0, 3).join(' ; ') + (bouge.length > 3 ? ' (+' + (bouge.length - 3) + ')' : '') : '')
          + ' — ' + nEvt + ' ecart(s)')
      }
    }
    journal.nEvenements = nEvt
    journal.erreursPage = erreurs
    const f = path.join(SORTIE, ETIQ + '.json')
    fs.writeFileSync(f, JSON.stringify(journal, null, 1))
    console.log('')
    console.log('TOTAL : ' + nEvt + ' ecart(s) sur ' + PASSES + ' passes, soit 1 sur ' + (nEvt ? (PASSES / nEvt).toFixed(1) : '—'))
    console.log('ecrit :', f)
    await nav.close()
    process.exit(0)
  }

  // ══════════ ⚡ MODE CHARGE — REPRODUIRE LE TRANSITOIRE À VOLONTÉ ══════════
  if (CHARGE) {
    const cdp = await page.createCDPSession()
    let nEvt = 0
    for (let i = 1; i <= PASSES; i++) {
      if (i > 1) prep = await preparer()
      await releve('r1')
      const e1 = await page.evaluate(photoEtat)
      // ⚡ ON RALENTIT, ON ATTEND PLUS QUE DOWN_SUSTAIN, PUIS ON RELACHE.
      // ⚠️ **ON MESURE LA CADENCE PENDANT LE RALENTISSEMENT, SINON ON NE SAIT
      // PAS SI L'EXPÉRIENCE A TESTÉ QUOI QUE CE SOIT.** Le gouverneur ne bouge
      // que sous **30 images/s** (`DOWN_FPS`) pendant **2,5 s** (`DOWN_SUSTAIN`).
      // Un ralentissement qui laisse la page à 45 i/s ne teste rien, et rendre
      // « palier inchangé » serait alors un faux négatif — exactement le genre
      // de silence qui fait conclure à tort.
      const cadence = () => page.evaluate((ms) => new Promise((res) => {
        let n = 0
        const t0 = performance.now()
        const tick = () => {
          n++
          if (performance.now() - t0 < ms) requestAnimationFrame(tick)
          else res(+(n / ((performance.now() - t0) / 1000)).toFixed(2))
        }
        requestAnimationFrame(tick)
      }), 2000)
      const fpsAvant = await cadence()
      await cdp.send('Emulation.setCPUThrottlingRate', { rate: CHARGE_TAUX })
      const fpsPendant = await cadence()
      await dodo(Math.max(0, CHARGE_MS - 2000))
      const fpsPendant2 = await cadence()
      await cdp.send('Emulation.setCPUThrottlingRate', { rate: 1 })
      // ⚠️ **ON MESURE APRÈS AVOIR RELÂCHÉ**, sinon on mesurerait le
      // ralentissement lui-même et non la DÉCISION du gouverneur.
      await dodo(1500)
      await releve('r2')
      const e2 = await page.evaluate(photoEtat)
      const d12 = await dist('r1', 'r2')
      // ⚡ ET ON ATTEND LA REMONTEE : UP_SUSTAIN vaut 12 s au-dessus de 55 i/s.
      await dodo(RETOUR_MS)
      await releve('r3')
      const e3 = await page.evaluate(photoEtat)
      const d13 = await dist('r1', 'r3')
      const ligne = {
        i, taux: CHARGE_TAUX,
        fps: { avant: fpsAvant, pendant: fpsPendant, pendant2: fpsPendant2 },
        chute: { moy: +d12.moy.toFixed(4), grad: +d12.grad.toFixed(4), pixels: d12.pixelsChanges, part: +d12.partChangee.toFixed(4), centre: d12.centre, boite: d12.boite },
        retour: { moy: +d13.moy.toFixed(4), grad: +d13.grad.toFixed(4), pixels: d13.pixelsChanges },
        palier: [e1.palier.n, e2.palier.n, e3.palier.n],
        pixelRatio: [e1.pixelRatio, e2.pixelRatio, e3.pixelRatio],
        banniere: [e1.banniere, e2.banniere, e3.banniere],
        diffChute: diffEtat(e1, e2),
        diffRetour: diffEtat(e2, e3),
      }
      journal.lignes.push(ligne)
      if (d12.moy > SEUIL) nEvt++
      console.log('     cadence : ' + fpsAvant + ' i/s avant · ' + fpsPendant + ' puis ' + fpsPendant2 + ' i/s sous ralentissement x' + CHARGE_TAUX
        + (Math.min(fpsPendant, fpsPendant2) >= 30 ? '  ⛔ AU-DESSUS DE DOWN_FPS=30 : le gouverneur n a AUCUNE raison de bouger' : '  ✅ sous DOWN_FPS=30'))
      console.log('  [' + i + '/' + PASSES + '] CHUTE moy=' + ligne.chute.moy + ' grad=' + ligne.chute.grad
        + ' (' + (ligne.chute.part * 100).toFixed(1) + ' % des pixels)'
        + ' · RETOUR moy=' + ligne.retour.moy + ' grad=' + ligne.retour.grad
        + ' · palier ' + JSON.stringify(ligne.palier) + ' · pixelRatio ' + JSON.stringify(ligne.pixelRatio))
      if (ligne.banniere.some(Boolean)) console.log('     BANNIERE : ' + JSON.stringify(ligne.banniere))
      for (const l of ligne.diffChute) console.log('     CHUTE  r1->r2 : ' + l)
      for (const l of ligne.diffRetour) console.log('     RETOUR r2->r3 : ' + l)
      await page.screenshot({ path: path.join(SORTIE, ETIQ + '-' + String(i).padStart(2, '0') + '.png') })
    }
    journal.nEvenements = nEvt
    journal.erreursPage = erreurs
    const f = path.join(SORTIE, ETIQ + '.json')
    fs.writeFileSync(f, JSON.stringify(journal, null, 1))
    console.log('')
    console.log('TOTAL : ' + nEvt + ' chute(s) visible(s) sur ' + PASSES + ' passes')
    console.log('ecrit :', f)
    await nav.close()
    process.exit(0)
  }

  await releve('prec')
  let etatPrec = await page.evaluate(photoEtat)
  journal.etatInitial = etatPrec
  let nEvt = 0
  for (let i = 1; i <= PASSES; i++) {
    await dodo(ENTRE_MS)
    await releve('cur')
    const etatCur = await page.evaluate(photoEtat)
    const d = await dist('prec', 'cur')
    const ligne = {
      i, moy: +d.moy.toFixed(4), grad: +d.grad.toFixed(4), pire: +d.pire.toFixed(2),
      pixels: d.pixelsChanges, part: +d.partChangee.toFixed(4), centre: d.centre, boite: d.boite,
    }
    journal.lignes.push(ligne)
    if (d.moy > SEUIL || d.grad > SEUIL * 2) {
      nEvt++
      // ⚡ **LE DIFF D'ÉTAT — c'est tout l'intérêt de ce banc.**
      const diff = diffEtat(etatPrec, etatCur)
      journal.evenements.push({ i, ...ligne, dtMs: +(etatCur.t - etatPrec.t).toFixed(1), diff })
      console.log('  ⚡ ECART passe ' + i + ' : moy=' + ligne.moy + ' grad=' + ligne.grad
        + ' pixels=' + ligne.pixels + ' (' + (ligne.part * 100).toFixed(1) + '%)'
        + ' centre=' + JSON.stringify(ligne.centre) + ' boite=' + JSON.stringify(ligne.boite))
      if (diff.length) for (const l of diff) console.log('     ETAT : ' + l)
      else console.log('     ETAT : RIEN N A BOUGE dans la liste relevee')
      await page.screenshot({ path: path.join(SORTIE, ETIQ + '-ecart-' + String(i).padStart(3, '0') + '.png') })
    } else if (i % 10 === 0) {
      console.log('  [' + i + '/' + PASSES + '] moy=' + ligne.moy + ' grad=' + ligne.grad + ' — ' + nEvt + ' ecart(s) jusqu ici')
    }
    await page.evaluate(() => { window.__tr.slots.prec = window.__tr.slots.cur })
    etatPrec = etatCur
  }
  journal.nEvenements = nEvt
  journal.erreursPage = erreurs
  const f = path.join(SORTIE, ETIQ + '.json')
  fs.writeFileSync(f, JSON.stringify(journal, null, 1))
  console.log('')
  console.log('TOTAL : ' + nEvt + ' ecart(s) sur ' + PASSES + ' passes, soit 1 sur ' + (nEvt ? (PASSES / nEvt).toFixed(1) : '—'))
  console.log('ecrit :', f)
} finally { await nav.close() }
