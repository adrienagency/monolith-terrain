// SONDE R21 — LES HUIT RÉGLAGES DE LUMIÈRE, MESURÉS AVEC LEUR PRÉCONDITION
//
// ⚠️ **ELLE EXISTE PARCE QUE `sonde-studio-r18.mjs` A MESURÉ LE BON CONTRÔLE
// AVEC LE MAUVAIS GESTE, TROIS FOIS.** L'inventaire donne 0,000 aux huit ; deux
// de ces zéros sont des artefacts de protocole, et un troisième est le zéro d'un
// contrôle CACHÉ :
//
//   · **n° 26, « Ombrage auto »** — c'est un LOQUET, pas un interrupteur
//     d'effet. Il est allumé au départ et ses quatre valeurs sont déjà posées :
//     l'éteindre n'écrit rien, le rallumer recalcule les MÊMES nombres. Un
//     aller-retour idempotent rend 0,000 **par construction**. Le geste qui le
//     voit : FIGER d'abord un des quatre (bouger « Contraste d'altitude » appelle
//     `markShadeDirty`), puis rallumer l'auto — `force: true` efface le gel.
//   · **n° 30, « Ombrage des pentes »** — sa ligne est `visibleWhen(!isNatural)`,
//     et le gabarit d'ouverture est en Atlas : la ligne est **cachée**. Mesurer
//     un contrôle caché ne dit rien de son branchement. Il faut d'abord cliquer
//     la vignette « Classique ».
//   · **n° 70 à 73, l'appoint** — les quatre curseurs sont derrière un
//     interrupteur ÉTEINT (`fillLightIntensity` rend 0 exactement). C'est
//     l'étalon que R18 documente lui-même : « Intensité du flou » = 0,000 parent
//     éteint, 9,815 parent allumé.
//
// ⚡ **ET LE PALIER MACHINE EST RELEVÉ DANS LE MÊME PASSAGE QUE CHAQUE MESURE.**
// `src/perf.js` peut COUPER les ombres (palier T3 « ESSENTIAL »), le grain et le
// pixelRatio. Mesurer « douceur des ombres » pendant que le palier a éteint les
// ombres, c'est lire zéro et conclure que le curseur est mort alors qu'il ne
// l'est pas. On journalise donc `window.__palierMachine.ombres`, `ombresRes`,
// `params.shadowMode`, `sun.castShadow` et `sun.shadow.mapSize` À CHAQUE LIGNE.
//
// L'instrument (condensé 256 × 160 + gradient local) est celui de
// `sonde-studio-r18.mjs`, repris tel quel : c'est lui qui a produit les chiffres
// de l'inventaire, et un second instrument rendrait les deux passes
// incomparables.
import fs from 'node:fs'
import path from 'node:path'
import { fileURLToPath } from 'node:url'

const RACINE = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..')
const args = process.argv.slice(2)
const opt = (n, d = null) => { const i = args.indexOf(n); return i >= 0 && args[i + 1] ? args[i + 1] : d }
const has = (n) => args.includes(n)
const PORT = Number(opt('--port', '5601'))
const SORTIE = opt('--sortie', path.join(RACINE, '.banc/R21'))
const ETIQUETTE = opt('--etiquette', 'apres')
const IMAGES = Number(opt('--images', '6'))
const REPOS_MS = Number(opt('--repos', '900'))
const VISIBLE = has('--visible')
const CAPTURES = has('--captures')
const LARG = 256
const HAUT = 160
const dodo = (ms) => new Promise((r) => setTimeout(r, ms))

function trouverChrome() {
  const donne = opt('--chrome', process.env.CHROME_PATH)
  if (donne) return donne
  const t = [
    'C:/Program Files/Google/Chrome/Application/chrome.exe',
    'C:/Program Files (x86)/Google/Chrome/Application/chrome.exe',
    '/usr/bin/google-chrome',
  ].find((p) => fs.existsSync(p))
  if (!t) { console.error('Chrome introuvable — passe --chrome <chemin>.'); process.exit(2) }
  return t
}
async function chargerPuppeteer() {
  for (const p of [
    path.join(RACINE, 'node_modules/puppeteer-core/lib/puppeteer/puppeteer-core.js'),
    'C:/Dev/wt-f3/node_modules/puppeteer-core/lib/puppeteer/puppeteer-core.js',
    'C:/Dev/wt-warm/node_modules/puppeteer-core/lib/puppeteer/puppeteer-core.js',
  ]) if (fs.existsSync(p)) return (await import('file:///' + p.split('\\').join('/'))).default
  console.error('puppeteer-core introuvable.')
  process.exit(2)
}

// ══════════ L'INSTRUMENT — celui de R18, au mot près ════════════════════════
function poserInstrument(LARG, HAUT) {
  const e = window.__exp
  if (!e) return 'pas de __exp'
  if (window.__r21) return 'déjà posé'
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
      w = nw; h = nh
      if (nw === LARG && nh === HAUT) break
    }
    gl.bindFramebuffer(gl.FRAMEBUFFER, null)
    gl.bindRenderbuffer(gl.RENDERBUFFER, null)
  }
  const px = new Uint8Array(LARG * HAUT * 4)
  function condense() {
    if (!etages.length || etages[0].w * 2 < CV.width) construireEtages()
    let srcFbo = null, sw = CV.width, sh = CV.height
    for (const et of etages) {
      gl.bindFramebuffer(gl.READ_FRAMEBUFFER, srcFbo)
      gl.bindFramebuffer(gl.DRAW_FRAMEBUFFER, et.fbo)
      gl.blitFramebuffer(0, 0, sw, sh, 0, 0, et.w, et.h, gl.COLOR_BUFFER_BIT, gl.LINEAR)
      srcFbo = et.fbo; sw = et.w; sh = et.h
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
  const etat = { n: 0, slots: {}, LARG, HAUT }
  window.__r21 = etat
  const tampon = []
  function boucle() {
    try {
      tampon.push(Float32Array.from(condense()))
      if (tampon.length > 24) tampon.shift()
      etat.n++
    } catch (err) { etat.erreur = String(err).slice(0, 120) }
    requestAnimationFrame(boucle)
  }
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
    const A = etat.slots[a], B = etat.slots[b]
    if (!A || !B) return null
    let sm = 0
    for (let i = 0; i < N; i++) sm += Math.abs(A.moy[i] - B.moy[i])
    let sg = 0
    for (let i = 0; i < LARG * HAUT; i++) sg += Math.abs(A.grad[i] - B.grad[i])
    return { moy: sm / N, grad: sg / (LARG * HAUT) }
  }
  requestAnimationFrame(boucle)
  return 'posé'
}

// ══════════ LE CATALOGUE DES CONTRÔLES — celui de R18 ═══════════════════════
function poserCibles() {
  const cibles = []
  const txt = (n) => (n?.textContent || '').trim()
  const nomDe = (r) => {
    const lab = r.querySelector('.ce-label')
    return lab ? [...lab.childNodes].filter((x) => x.nodeType === 3).map((x) => x.textContent).join('').trim() : ''
  }
  for (const p of [...document.querySelectorAll('.ce-panel'), ...document.querySelectorAll('.ce-settings')]) {
    const titre = txt(p.querySelector('.ce-panel-title')) || txt(p.querySelector('.ce-settings-head b')) || p.className
    let section = ''
    const push = (o) => cibles.push({ panneau: titre, section, ...o })
    const walk = (n) => {
      for (const c of n.children) {
        if (c.classList?.contains('ce-section')) section = txt(c.querySelector('.ce-section-title')) || section
        if (c.classList?.contains('ce-row')) {
          const nom = nomDe(c)
          const rng = c.querySelector('input[type=range]')
          const col = c.querySelector('input[type=color]')
          const tog = c.querySelector('button.ce-toggle')
          const cache = () => c.style.display === 'none'
          if (rng) {
            let orig = null
            push({ nom, type: 'slider', cache, plage: [rng.min, rng.max], apply: (ph) => {
              if (ph === 0) orig = rng.value
              rng.value = ph === 0 ? rng.min : ph === 1 ? rng.max : orig
              rng.dispatchEvent(new Event('input', { bubbles: true }))
              rng.dispatchEvent(new Event('change', { bubbles: true }))
              return rng.value
            } })
          } else if (col) {
            let orig = null
            push({ nom, type: 'color', cache, apply: (ph) => {
              if (ph === 0) orig = col.value
              col.value = ph === 0 ? '#ff2000' : ph === 1 ? '#00e0ff' : orig
              col.dispatchEvent(new Event('input', { bubbles: true }))
              return col.value
            } })
          } else if (tog) {
            let orig = null
            push({ nom, type: 'toggle', cache, apply: (ph) => {
              if (ph === 0) orig = tog.classList.contains('on')
              if (ph === 2) { if (tog.classList.contains('on') !== orig) tog.click() }
              else tog.click()
              return tog.classList.contains('on') ? 'on' : 'off'
            } })
          }
        }
        walk(c)
      }
    }
    walk(p)
  }
  window.__r21.cibles = cibles
  return cibles.map((c, i) => ({ i, panneau: c.panneau, section: c.section, nom: c.nom, type: c.type, cache: c.cache?.() ?? false, plage: c.plage || null }))
}

// ══════════ LES PRÉCONDITIONS, CHACUNE NOMMÉE ET VÉRIFIÉE ══════════════════
const PRE = {
  // l'interrupteur d'appoint : `setFillEnabled` monte aussi l'intensité à 0,6
  // quand elle vaut 0, sinon les quatre curseurs resteraient derrière un zéro
  appoint: () => {
    const nomDe = (r) => {
      const lab = r.querySelector('.ce-label')
      return lab ? [...lab.childNodes].filter((x) => x.nodeType === 3).map((x) => x.textContent).join('').trim() : ''
    }
    for (const r of document.querySelectorAll('.ce-row')) {
      const t = r.querySelector('button.ce-toggle')
      if (t && nomDe(r) === 'Appoint' && !t.classList.contains('on')) t.click()
    }
    return { fillEnabled: window.__exp.params.fillEnabled, fillIntensite: window.__exp.params.fillIntensity }
  },
  // le mode Classique : la ligne « Ombrage des pentes » est cachée en Atlas
  classique: () => {
    const v = [...document.querySelectorAll('.ce-mat-vig')].find((x) => (x.textContent || '').includes('Classique'))
    if (v && !v.classList.contains('on')) v.click()
    return { colorMode: window.__exp.params.colorMode, uColorMode: window.__exp.terrain.mapUniforms.uColorMode.value }
  },
  // FIGER un des quatre réglages d'ombrage : c'est ce que le loquet défait
  figerContraste: () => {
    const nomDe = (r) => {
      const lab = r.querySelector('.ce-label')
      return lab ? [...lab.childNodes].filter((x) => x.nodeType === 3).map((x) => x.textContent).join('').trim() : ''
    }
    for (const r of document.querySelectorAll('.ce-row')) {
      if (nomDe(r) !== 'Contraste d’altitude') continue
      const rng = r.querySelector('input[type=range]')
      rng.value = rng.max
      rng.dispatchEvent(new Event('input', { bubbles: true }))
      rng.dispatchEvent(new Event('change', { bubbles: true }))
    }
    return { heightContrast: window.__exp.params.heightContrast, geles: window.__exp.shadeFrozen ?? null }
  },
}

// ⚠️ **UN TÉMOIN NUL EN TÊTE, ET IL A DÉJÀ SERVI.** Il rejoue le protocole
// EXACT — mêmes attentes, mêmes quatre relevés — SANS toucher un seul contrôle.
// Sans lui, le n° 68 a rendu 0,162 une fois et 0,000 une autre : impossible de
// dire si c'est le curseur ou une dérive de la scène. C'est la leçon ③ de
// `lecons-campagne-R.md` : sans témoin, l'arbitre condamnait un collègue à tort.
const SCENARIOS = [
  { n: 0, nom: 'TÉMOIN NUL', panneau: null, pre: null, temoin: true },
  { n: 68, nom: 'Douceur des ombres', panneau: 'Éléments', pre: null },
  { n: 69, nom: 'Appoint', panneau: 'Éléments', pre: null },
  { n: 70, nom: 'Intensité', panneau: 'Éléments', section: 'Lumière', pre: 'appoint' },
  { n: 71, nom: 'Écart au soleil', panneau: 'Éléments', pre: 'appoint' },
  { n: 72, nom: 'Hauteur', panneau: 'Éléments', section: 'Lumière', pre: 'appoint' },
  { n: 73, nom: 'Couleur', panneau: 'Éléments', section: 'Lumière', pre: 'appoint' },
  { n: 26, nom: 'Ombrage auto', panneau: 'Terrain', pre: 'figerContraste' },
  { n: 30, nom: 'Ombrage des pentes', panneau: 'Terrain', pre: 'classique' },
]

const puppeteer = await chargerPuppeteer()
const nav = await puppeteer.launch({
  executablePath: trouverChrome(),
  headless: !VISIBLE,
  args: [...(VISIBLE ? [] : ['--headless=new']), '--no-sandbox', '--enable-unsafe-swiftshader', '--window-size=1280,900'],
})
fs.mkdirSync(SORTIE, { recursive: true })
const rapport = { etiquette: ETIQUETTE, port: PORT, images: IMAGES, grille: [LARG, HAUT], lignes: [] }

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

  // ⚠️ **UN RECHARGEMENT PAR SCÉNARIO, ET C'EST LE PRIX DE NE RIEN SUPPOSER.**
  // R18 a payé la leçon : un contrôle laisse derrière lui un état qu'on ne
  // connaît pas, et 65 lignes ont été mesurées de nuit sans que rien ne le dise.
  async function preparer() {
    await page.goto(`http://localhost:${PORT}/`, { waitUntil: 'domcontentloaded', timeout: 120000 })
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
    // ⚡ le mouvement ambiant coupé : le plancher de bruit tombe à 0,0000, et la
    // rotation propre du globe (~1,9 °/s après 3 s) avec lui
    await page.evaluate(() => { window.__exp.params.animations = false })
    // ⚠️ **LE PLANCHER DE BRUIT NE TOMBE PAS AVEC LE MOUVEMENT AMBIANT SEUL.**
    // Premier passage : 0,157 / 0,315 alors que R18 relevait 0,0000. La cause
    // n'est pas la mer, elle est COUPÉE — ce sont les tuiles qui arrivent encore
    // du réseau et qui s'affinent. On attend donc que la file du globe se vide,
    // et on retombe sur le plancher de R18.
    // ⚠️ **ON ATTEND L'ÉTAT DES TUILES, ON NE COMPTE PAS LES SECONDES.** Le
    // quadtree porte l'état de chacune (`empty` / `loading` / prête) : tant qu'il
    // en reste une en vol, l'image change encore, et ce changement-là serait
    // attribué au curseur qu'on bouge.
    await page.waitForFunction(() => {
      const t = window.__exp.globe?.tiles
      if (!t) return true
      let enVol = 0
      for (const v of t.values()) if (v.state === 'loading' || v.state === 'empty') enVol++
      window.__enVol = enVol
      return enVol === 0
    }, { polling: 250, timeout: 45000 }).catch(() => {})
    await dodo(4000)
    return page.evaluate(poserCibles)
  }

  const etatMachine = () => page.evaluate(() => {
    const e = window.__exp
    const P = window.__palierMachine || {}
    return {
      palier: P.palier, palierNom: P.nom, ombres: P.ombres, ombresRes: P.ombresRes,
      ecranPalier: P.signaux?.ecran, densite: P.densite,
      shadowMode: e.params.shadowMode,
      castShadow: e.sun?.castShadow ?? null,
      shadowRadius: e.sun?.shadow?.radius ?? null,
      shadowMap: e.sun?.shadow?.mapSize ? [e.sun.shadow.mapSize.width, e.sun.shadow.mapSize.height] : null,
      mode: e.modes.mode, altM: +e.modes.altM.toFixed(1),
      terrainVisible: e.terrain?.mesh?.visible ?? null,
      uEclairageOn: e.globe.uniforms.uEclairageOn.value,
      uAppointIrr: e.globe.uniforms.uAppointIrr ? [e.globe.uniforms.uAppointIrr.value.x, e.globe.uniforms.uAppointIrr.value.y, e.globe.uniforms.uAppointIrr.value.z].map((x) => +x.toFixed(4)) : 'absent',
      uSlopeTint: e.globe.uniforms.uSlopeTint ? +e.globe.uniforms.uSlopeTint.value.toFixed(4) : 'absent',
      uAlbedoTeinte: +e.globe.uniforms.uAlbedoTeinte.value.toFixed(4),
      uHeightContrast: +e.globe.uniforms.uHeightContrast.value.toFixed(4),
      fill: (() => { const f = e.scene.children.find((c) => c.isDirectionalLight && !c.castShadow); return f ? { intensite: +f.intensity.toFixed(4), couleur: f.color.getHexString() } : null })(),
    }
  })

  const releve = async (nom) => {
    await page.evaluate(() => window.__r21.vider())
    await page.waitForFunction((n) => window.__r21.pret(n), { polling: 30, timeout: 45000 }, IMAGES)
    return page.evaluate((n, k) => window.__r21.capturer(n, k), nom, IMAGES)
  }
  const dist = (a, b) => page.evaluate((x, y) => window.__r21.distance(x, y), a, b)

  let controles = await preparer()
  rapport.gpu = await page.evaluate(() => {
    const gl = window.__exp?.renderer?.getContext?.()
    const d = gl?.getExtension('WEBGL_debug_renderer_info')
    return d ? String(gl.getParameter(d.UNMASKED_RENDERER_WEBGL)) : 'inconnu'
  })
  rapport.machine = await etatMachine()
  console.log('pilote WebGL :', rapport.gpu)
  console.log('machine :', JSON.stringify(rapport.machine))

  // ── PLANCHER DE BRUIT, mesuré sur place, six relevés d'un état intouché
  const mesurerPlancher = async () => {
    const m = [], g = []
    await releve('p0')
    for (let i = 0; i < 6; i++) {
      await dodo(REPOS_MS)
      await releve('p1')
      const d = await dist('p0', 'p1')
      m.push(d.moy); g.push(d.grad)
      await page.evaluate(() => { window.__r21.slots.p0 = window.__r21.slots.p1 })
    }
    m.sort((x, y) => x - y); g.sort((x, y) => x - y)
    return { moy: m[5], grad: g[5], moyTous: m, gradTous: g }
  }
  rapport.plancher = await mesurerPlancher()
  console.log('plancher de bruit : moy', rapport.plancher.moy.toFixed(4), '| grad', rapport.plancher.grad.toFixed(4))
  // ⚠️ **UN PLANCHER ABSOLU EN PLUS DU PLANCHER MESURÉ** — mouvement coupé, la
  // scène est reproductible AU BIT PRÈS et le plancher mesuré vaut 0,0000 :
  // diviser par lui rendrait des rapports à huit chiffres. Les deux seuils sont
  // ceux de R18, pour que les deux passes se comparent.
  const PM = Math.max(rapport.plancher.moy, 0.02)
  const PG = Math.max(rapport.plancher.grad, 0.05)

  const REPETE = Number(opt('--repete', '1'))
  const LISTE = []
  for (let r = 0; r < REPETE; r++) for (const sc of SCENARIOS) LISTE.push({ ...sc, tour: r + 1 })
  for (const sc of LISTE) {
    // une page NEUVE par scénario : la précondition d'un scénario ne doit pas
    // fuir dans le suivant (le défaut que R18 a payé sur 65 lignes)
    if (rapport.lignes.length) controles = await preparer()
    const ligne = { n: sc.n, tour: sc.tour, nom: sc.nom, panneau: sc.panneau, pre: sc.pre }
    try {
      if (sc.pre) {
        ligne.preEtat = await page.evaluate(PRE[sc.pre])
        await dodo(2200)
      }
      // ⚠️ la cible est retrouvée APRÈS la précondition : un picker cliqué
      // reconstruit ses lignes, et un index d'avant ne les désignerait plus
      controles = await page.evaluate(poserCibles)
      let bouge = async () => ({ pose: 'rien' })
      if (!sc.temoin) {
        const c = controles.find((x) => x.nom === sc.nom && x.panneau === sc.panneau)
        if (!c) { ligne.err = 'contrôle introuvable'; rapport.lignes.push(ligne); continue }
        ligne.cache = c.cache
        ligne.type = c.type
        ligne.plage = c.plage
        bouge = (ph) => page.evaluate((i, p) => {
          try { return { pose: String(window.__r21.cibles[i].apply(p)) } } catch (er) { return { err: String(er.message).slice(0, 120) } }
        }, c.i, ph)
      }

      await releve('avant')
      const p0 = await bouge(0)
      await dodo(REPOS_MS)
      await releve('a')
      const p1 = await bouge(1)
      await dodo(REPOS_MS)
      await releve('b')
      ligne.machine = await etatMachine()
      await bouge(2)
      await dodo(REPOS_MS)
      await releve('apres')

      const dA = await dist('avant', 'a')
      const dB = await dist('avant', 'b')
      const dAB = await dist('a', 'b')
      const dR = await dist('avant', 'apres')
      ligne.pose = [p0.pose ?? p0.err, p1.pose ?? p1.err]
      ligne.moy = Math.max(dA.moy, dB.moy, dAB.moy)
      ligne.grad = Math.max(dA.grad, dB.grad, dAB.grad)
      // ⚠️ **LA VALEUR LA MOINS FAVORABLE EST PUBLIÉE AUSSI** — leçon ① de
      // `lecons-campagne-R.md` : quand deux chiffres existent, on donne les deux.
      ligne.moyMin = Math.min(dA.moy, dB.moy, dAB.moy)
      ligne.gradMin = Math.min(dA.grad, dB.grad, dAB.grad)
      ligne.dRetour = { moy: dR.moy, grad: dR.grad }
      ligne.rapportPlancher = Math.max(ligne.moy / PM, ligne.grad / PG)
      if (CAPTURES && !sc.temoin) {
        await bouge(1)
        await dodo(REPOS_MS)
        await page.screenshot({ path: path.join(SORTIE, `${ETIQUETTE}-${sc.n}-${sc.nom.replace(/[^\wÀ-ɏ]+/g, '_')}.png`) })
      }
    } catch (er) {
      ligne.err = String(er.message).slice(0, 200)
    }
    rapport.lignes.push(ligne)
    const f = (x) => (typeof x === 'number' ? x.toFixed(3) : '—')
    console.log(
      `[${String(sc.n).padStart(2)}·${sc.tour}] ${sc.nom.padEnd(22)} ${sc.temoin ? '—      ' : ligne.cache ? 'CACHÉ  ' : 'visible'} ` +
      `moy=${f(ligne.moy)} (${f(ligne.moyMin)}) grad=${f(ligne.grad)} (${f(ligne.gradMin)}) ` +
      `×${ligne.rapportPlancher ? ligne.rapportPlancher.toFixed(1) : '—'} ` +
      `| ombres=${ligne.machine?.ombres} ${ligne.machine?.ombresRes} cast=${ligne.machine?.castShadow} ` +
      `| appointIrr=${JSON.stringify(ligne.machine?.uAppointIrr)} pente=${ligne.machine?.uSlopeTint}` +
      (ligne.err ? ` ⛔ ${ligne.err}` : '')
    )
  }
  rapport.erreursPage = erreurs
  const fichier = path.join(SORTIE, `sonde-${ETIQUETTE}.json`)
  fs.writeFileSync(fichier, JSON.stringify(rapport, null, 1))
  console.log('écrit :', fichier)
} finally { await nav.close() }
