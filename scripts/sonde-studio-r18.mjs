// SONDE STUDIO R18 — « marche » se prouve en DÉPLAÇANT la valeur, pas en lisant le code.
//
// Elle pilote les VRAIS contrôles du DOM (les `.ce-row` construits par kit.js),
// exactement comme un doigt sur le curseur : `input.value = x` puis un vrai
// événement `input`. Aucun chemin parallèle, aucune recopie du corps de `set:`.
//
// Ce qu'elle relève : un CONDENSÉ de l'image rendue (chaîne de blits qui
// divisent par deux — une vraie moyenne de boîte, pas un point échantillonné),
// moyenné sur plusieurs images pour absorber la mer et les nuages qui bougent.
//
// Verdict d'une option = distance(condensé avant, condensé après) comparée au
// PLANCHER DE BRUIT mesuré sur place par deux témoins consécutifs sans rien
// toucher.
import fs from 'node:fs'
import path from 'node:path'
import { fileURLToPath } from 'node:url'

const RACINE = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..')
const args = process.argv.slice(2)
const opt = (n, d = null) => {
  const i = args.indexOf(n)
  return i >= 0 && args[i + 1] ? args[i + 1] : d
}
const has = (n) => args.includes(n)

const PORT = Number(opt('--port', '5561'))
const SORTIE = opt('--sortie', path.join(RACINE, '.banc/R18'))
const FILTRE = opt('--filtre', '')
const IMAGES = Number(opt('--images', '6')) // images moyennées par relevé
const REPOS_MS = Number(opt('--repos', '700')) // attente après une écriture
const CAPTURES = has('--captures')
// ⚡ LES PRÉCONDITIONS, ET CE N'EST PAS UN CONFORT. Une tirette rangée derrière
// `visibleWhen` — « Opacité de la photo » derrière « Photo aérienne » — mesurée
// avec son parent ÉTEINT rend toujours « ne fait rien » : c'est un artefact de
// protocole, pas un verdict. `--pre` allume les parents AVANT d'énumérer.
const PRE = has('--pre')
// ⚡ `--fige` coupe le mouvement ambiant (params.animations) AVANT de mesurer :
// le plancher de bruit tombe d'un ordre de grandeur, et la zone grise 1×-2×
// se vide. ⛔ À N'UTILISER QUE pour les options qui ne SONT pas du mouvement —
// vitesse de dérive, clapot, vitesse de houle n'ont plus rien à montrer.
const FIGE = has('--fige')
const VISIBLE = has('--visible')
// ⛔ **64 × 40 ÉTAIT AVEUGLE, ET UNE CAPTURE L'A PROUVÉ.** « Hauteur des vagues »
// de 0 à 2 change la mer À VUE D'ŒIL (crêtes dessinées sur toute la nappe) et
// rendait pourtant 1,45 × le plancher : une moyenne de boîte de 20 × 20 pixels
// ANNULE un motif fin — les crêtes claires et les creux sombres se compensent
// dans la même case. La grille passe à 256 × 160 ET une seconde grandeur
// arrive : le GRADIENT local, qui ne mesure pas la couleur moyenne mais la
// quantité de détail. Une option qui grave un motif la fait bouger ; une
// moyenne de boîte, non.
const LARG = 256
const HAUT = 160

function trouverChrome() {
  const donne = opt('--chrome', process.env.CHROME_PATH)
  if (donne) return donne
  const pistes = [
    'C:/Program Files/Google/Chrome/Application/chrome.exe',
    'C:/Program Files (x86)/Google/Chrome/Application/chrome.exe',
    '/usr/bin/google-chrome',
  ]
  const t = pistes.find((p) => fs.existsSync(p))
  if (!t) { console.error('Chrome introuvable — passe --chrome <chemin>.'); process.exit(2) }
  return t
}
async function chargerPuppeteer() {
  const pistes = [
    path.join(RACINE, 'node_modules/puppeteer-core/lib/puppeteer/puppeteer-core.js'),
    'C:/Dev/wt-f3/node_modules/puppeteer-core/lib/puppeteer/puppeteer-core.js',
    'C:/Dev/wt-warm/node_modules/puppeteer-core/lib/puppeteer/puppeteer-core.js',
  ]
  for (const p of pistes) {
    if (!fs.existsSync(p)) continue
    return (await import('file:///' + p.replace(/\\/g, '/'))).default
  }
  console.error('puppeteer-core introuvable.')
  process.exit(2)
}

// ══════════ L'INSTRUMENT ════════════════════════════════════════════════════
function poserInstrument(LARG, HAUT) {
  const e = window.__exp
  if (!e) return 'pas de __exp'
  if (window.__r18) return 'déjà posé'
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
  // ⚡ **TOUT LE CALCUL RESTE DANS LA PAGE.** À 256 × 160 le condensé pèse
  // 122 880 nombres : les faire traverser CDP en JSON à chaque relevé coûtait
  // plus cher que le rendu. Node ne reçoit plus que des scalaires.
  const N = LARG * HAUT * 3
  const etat = { n: 0, dessins: [], slots: {}, LARG, HAUT }
  window.__r18 = etat
  const tampon = []
  const renderOrig = R.render.bind(R)
  R.render = function (sc, cam) {
    const r = renderOrig(sc, cam)
    const i = R.info.render
    etat.dessins.push((cam === e.camera ? 'bloc' : cam === e.camGlobe ? 'fond' : 'autre') + ':' + i.calls + '/' + i.triangles)
    if (etat.dessins.length > 40) etat.dessins.shift()
    return r
  }
  function boucle() {
    try {
      tampon.push(Float32Array.from(condense()))
      if (tampon.length > 24) tampon.shift()
      etat.n++
    } catch (err) { etat.erreur = String(err).slice(0, 120) }
    requestAnimationFrame(boucle)
  }
  // LE GRADIENT : |dx| + |dy| sur la luminance, par pixel du condensé. C'est la
  // grandeur qui voit un MOTIF apparaître là où la moyenne ne voit rien.
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
    etat.slots[nom] = { moy, grad: gradientDe(moy), dessins: etat.dessins.slice(-4) }
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

// ══════════ LE CATALOGUE DES CONTRÔLES, LU DANS LE DOM ══════════════════════
// ⚠️ Les cibles sont construites UNE fois dans la page et gardées en fermeture :
// le nœud est capturé, pas retrouvé par index à chaque appel. Un picker qui se
// reconstruit (renderPicker) invaliderait un index ; il ne peut pas invalider
// une fonction qui repart du CONTENEUR (`.ce-mat-pick`), lequel, lui, survit.
function poserCibles() {
  const cibles = []
  const txt = (n) => (n?.textContent || '').trim()
  const conteneurs = [
    ...document.querySelectorAll('.ce-panel'),
    ...document.querySelectorAll('.ce-settings'),
  ]
  for (const p of conteneurs) {
    const titre = txt(p.querySelector('.ce-panel-title')) || txt(p.querySelector('.ce-settings-head b')) || p.className
    const horsMode = p.classList.contains('wm-off')
    let section = ''
    const push = (o) => cibles.push({ panneau: titre, section, horsMode, ...o })
    const walk = (n) => {
      for (const c of n.children) {
        if (c.classList?.contains('ce-section')) section = txt(c.querySelector('.ce-section-title')) || section
        // ---- une ligne de kit.js
        if (c.classList?.contains('ce-row')) {
          const lab = c.querySelector('.ce-label')
          const nom = lab ? [...lab.childNodes].filter((x) => x.nodeType === 3).map((x) => x.textContent).join('').trim() : ''
          const rng = c.querySelector('input[type=range]')
          const col = c.querySelector('input[type=color]')
          const sel = c.querySelector('select')
          const tog = c.querySelector('button.ce-toggle')
          const seg = c.querySelector('.ce-seg')
          const cache = () => c.style.display === 'none'
          if (rng) {
            let orig = null
            push({ nom, type: 'slider', cache, plage: [rng.min, rng.max], apply: (ph) => {
              if (ph === 0) orig = rng.value
              rng.value = ph === 0 ? rng.min : ph === 1 ? rng.max : orig
              rng.dispatchEvent(new Event('input', { bubbles: true }))
              // ⛔ **`input` NE SUFFIT PAS, ET TROIS OPTIONS EN SONT MORTES À
              // TORT AU PREMIER TOUR.** « Échelle fine », « Détail fin » et
              // « Échelle du détail » ne COMMITENT qu'au relâchement : leur
              // panneau écoute `change` pour rebâtir le terrain. Une sonde qui
              // n'émet que `input` bouge le curseur et ne déclenche jamais le
              // travail — elle mesure un curseur qu'on traîne sans le lâcher.
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
          } else if (sel) {
            let orig = null
            const opts = [...sel.options].map((o) => o.value)
            push({ nom, type: 'select', cache, plage: [opts[0], opts[opts.length - 1]], apply: (ph) => {
              if (ph === 0) orig = sel.value
              sel.value = ph === 0 ? opts[0] : ph === 1 ? opts[opts.length - 1] : orig
              sel.dispatchEvent(new Event('change', { bubbles: true }))
              return sel.value
            } })
          } else if (tog) {
            let orig = null
            push({ nom, type: 'toggle', cache, apply: (ph) => {
              if (ph === 0) orig = tog.classList.contains('on')
              if (ph === 2) { if (tog.classList.contains('on') !== orig) tog.click() }
              else tog.click()
              return tog.classList.contains('on') ? 'on' : 'off'
            } })
          } else if (seg) {
            let orig = -1
            const btns = () => [...seg.querySelectorAll('.ce-seg-btn')]
            push({ nom: nom || txt(c.querySelector('.ce-label')) || 'segments', type: 'segmented', cache, apply: (ph) => {
              const b = btns()
              if (ph === 0) orig = b.findIndex((x) => x.classList.contains('on'))
              if (ph === 2) { if (orig >= 0) b[orig]?.click(); return orig >= 0 ? txt(b[orig]) : '(rien)' }
              const t = ph === 0 ? b[0] : b[b.length - 1]
              t?.click()
              return txt(t)
            } })
          }
        }
        // ---- un picker de vignettes (matières, effets, fonds, ciels, fonds marins…)
        if (c.classList?.contains('ce-mat-pick') || c.classList?.contains('ce-mat-grid')) {
          if (!c.closest('.ce-mat-pick') || c.classList.contains('ce-mat-pick')) {
            const vigs = () => [...c.querySelectorAll('.ce-mat-vig')]
            if (vigs().length >= 2) {
              let orig = -1
              push({ nom: 'picker (' + vigs().length + ' vignettes)', type: 'picker', cache: () => c.style.display === 'none',
                apply: (ph) => {
                  const v = vigs()
                  if (ph === 0) orig = v.findIndex((x) => x.classList.contains('on'))
                  if (ph === 2) { if (orig >= 0) v[orig]?.click(); return orig >= 0 ? 'retour' : '(rien)' }
                  const t = ph === 0 ? v[0] : v[v.length - 1]
                  t?.click()
                  return (t?.getAttribute('data-tip') || txt(t) || '?').slice(0, 40)
                } })
            }
          }
        }
        // ---- une rangée de chips (presets)
        if (c.classList?.contains('ce-chiprow')) {
          const chips = () => [...c.querySelectorAll('.ce-chip')]
          if (chips().length >= 2) {
            let orig = -1
            push({ nom: 'chips (' + chips().map(txt).join('/') + ')', type: 'chips', cache: () => c.style.display === 'none',
              apply: (ph) => {
                const b = chips()
                if (ph === 0) orig = b.findIndex((x) => x.classList.contains('on'))
                // ⛔ AUCUNE CHIP ALLUMEE AU DEPART = AUCUNE A REMETTRE. Cliquer
                // la premiere « pour faire quelque chose » laissait la scene sur
                // un etat qui n'etait pas celui d'avant — c'est ce qui a
                // contamine toute la fin de la premiere passe (Nuit, 65 lignes).
                if (ph === 2) { if (orig >= 0) b[orig]?.click(); return orig >= 0 ? txt(b[orig]) : '(rien)' }
                const t = ph === 0 ? b[0] : b[b.length - 1]
                t?.click()
                return txt(t)
              } })
          }
        }
        // ---- une rampe de nuanciers nus (palette du relief)
        if (c.classList?.contains('ce-ramp')) {
          const sw = () => [...c.querySelectorAll('input.ce-swatch')]
          if (sw().length >= 2) {
            let orig = []
            push({ nom: 'rampe (' + sw().length + ' arrêts)', type: 'rampe', cache: () => c.style.display === 'none',
              apply: (ph) => {
                const s = sw()
                if (ph === 0) orig = s.map((x) => x.value)
                s.forEach((x, i) => {
                  x.value = ph === 0 ? '#ff2000' : ph === 1 ? '#00e0ff' : orig[i]
                  x.dispatchEvent(new Event('input', { bubbles: true }))
                })
                return s[0].value
              } })
          }
        }
        walk(c)
      }
    }
    walk(p)
  }
  window.__r18.cibles = cibles
  return cibles.map((c, i) => ({ i, panneau: c.panneau, section: c.section, nom: c.nom, type: c.type, horsMode: c.horsMode, cache: c.cache?.() ?? false, plage: c.plage || null }))
}
const dodo = (ms) => new Promise((r) => setTimeout(r, ms))

const puppeteer = await chargerPuppeteer()
const nav = await puppeteer.launch({
  executablePath: trouverChrome(),
  headless: !VISIBLE,
  args: [...(VISIBLE ? [] : ['--headless=new']), '--no-sandbox', '--enable-unsafe-swiftshader',
    '--window-size=1280,900', '--autoplay-policy=no-user-gesture-required'],
})
fs.mkdirSync(SORTIE, { recursive: true })
const rapport = { port: PORT, images: IMAGES, reposMs: REPOS_MS, grille: [LARG, HAUT], lignes: [] }

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

  // ══════════ LA REMISE À NEUF ═══════════════════════════════════════════════
  //
  // ⛔ **LA PREMIÈRE PASSE A ÉTÉ CONTAMINÉE À LA LIGNE 61 ET PERSONNE NE
  // L'AURAIT VU DANS LE JOURNAL** : la rangée de chips d'ambiance n'avait aucune
  // chip allumée au départ, la « remise à l'origine » a donc cliqué la première
  // par défaut… et la scène est restée à une autre heure. Les 65 lignes
  // suivantes ont été mesurées de nuit, où plus rien ne se voit : elles rendent
  // toutes « ne fait rien ».
  //
  // ⚡ **LA PARADE EST UN RECHARGEMENT, ET IL EST MESURÉ** : après chaque
  // contrôle on compare l'état RENDU au départ ; s'il n'y est pas revenu, la
  // page repart de zéro avant le contrôle suivant. Cher, mais c'est le seul
  // protocole qui ne suppose rien de ce qu'une option laisse derrière elle.
  async function preparer() {
    await page.goto(`http://localhost:${PORT}/`, { waitUntil: 'domcontentloaded', timeout: 120000 })
    await page.waitForFunction(() => window.__exp?.modes && window.__exp?.globe && window.__exp?.composer, { timeout: 90000, polling: 100 })
    await dodo(8000)
    await page.keyboard.press('Escape')
    await dodo(3000)
    await page.evaluate(() => {
      for (const p of document.querySelectorAll('.ce-panel')) p.classList.remove('collapsed')
      for (const s of document.querySelectorAll('.ce-section')) s.classList.add('open')
      document.body.classList.add('ce-railL-off', 'ce-railR-off')
    })
    await dodo(1500)
    await page.evaluate(poserInstrument, LARG, HAUT)
    if (FIGE) { await page.evaluate(() => { window.__exp.params.animations = false }); await dodo(1200) }
    if (PRE) {
      await page.evaluate(() => {
        const nomDe = (r) => {
          const lab = r.querySelector('.ce-label')
          return lab ? [...lab.childNodes].filter((x) => x.nodeType === 3).map((x) => x.textContent).join('').trim() : ''
        }
        const ALLUMER = ['Photo aérienne', 'Mer animée', 'Flou de profondeur (bokeh)',
          'Ombrage des creux (SSAO)', 'Diffusion dans la matière (SSS)', 'Afficher le socle',
          'Rivières & eau', 'Villes & lieux', 'Sommets', 'Points cotés', 'Tranche de verre']
        for (const r of document.querySelectorAll('.ce-row')) {
          const t = r.querySelector('button.ce-toggle')
          if (t && ALLUMER.includes(nomDe(r)) && !t.classList.contains('on')) t.click()
        }
        const chip = [...document.querySelectorAll('.ce-chip')].find((c) => c.textContent.trim() === 'Épars')
        if (chip && !chip.classList.contains('on')) chip.click()
      })
      await dodo(9000) // la photo aérienne compose ~80 tuiles
    }
    return page.evaluate(poserCibles)
  }

  let controles = await preparer()
  rapport.gpu = await page.evaluate(() => {
    try {
      const gl = window.__exp?.renderer?.getContext?.()
      const d = gl?.getExtension('WEBGL_debug_renderer_info')
      return d ? String(gl.getParameter(d.UNMASKED_RENDERER_WEBGL)) : 'inconnu'
    } catch (er) { return 'erreur: ' + er.message }
  })
  rapport.etat = await page.evaluate(() => ({
    mode: window.__exp.modes.mode,
    altM: window.__exp.modes.altM,
    baseYCrop: window.__exp.globe?.baseYCrop ?? null,
    heure: window.__exp.params.timeOfDay,
    centre: (() => { const el = document.elementFromPoint(640, 400); return el ? el.tagName + '.' + (el.className || '') : 'rien' })(),
  }))
  rapport.nbControles = controles.length
  console.log('pilote WebGL :', rapport.gpu)
  console.log('état :', JSON.stringify(rapport.etat))
  console.log(`contrôles trouvés : ${controles.length}`)
  await page.screenshot({ path: path.join(SORTIE, 'init.png') })
  fs.writeFileSync(path.join(SORTIE, 'controles.json'), JSON.stringify(controles, null, 1))

  // ── LE RELEVÉ : on remplit un SLOT dans la page, et on n'en rapporte rien.
  const releve = async (nom) => {
    await page.evaluate(() => window.__r18.vider())
    await page.waitForFunction((n) => window.__r18.pret(n), { polling: 30, timeout: 45000 }, IMAGES)
    return page.evaluate((n, k) => window.__r18.capturer(n, k), nom, IMAGES)
  }
  const dist = (a, b) => page.evaluate((x, y) => window.__r18.distance(x, y), a, b)

  // ── PLANCHER DE BRUIT : deux relevés consécutifs d'un état qu'on ne touche pas
  const mesurerPlancher = async () => {
    const m = [], g = []
    await releve('p0')
    for (let i = 0; i < 6; i++) {
      await dodo(REPOS_MS)
      await releve('p1')
      const d = await dist('p0', 'p1')
      m.push(d.moy); g.push(d.grad)
      await page.evaluate(() => { window.__r18.slots.p0 = window.__r18.slots.p1 })
    }
    m.sort((x, y) => x - y); g.sort((x, y) => x - y)
    return { moy: { valeurs: m, max: m[5], median: m[3] }, grad: { valeurs: g, max: g[5], median: g[3] } }
  }
  rapport.plancher = await mesurerPlancher()
  console.log('plancher de bruit : moy', rapport.plancher.moy.max.toFixed(4), '| grad', rapport.plancher.grad.max.toFixed(4))
  // ⚡ **UN PLANCHER ABSOLU EN PLUS DU PLANCHER MESURÉ.** Mouvement ambiant
  // coupé, la scène est BIT POUR BIT reproductible : le plancher mesuré vaut
  // exactement 0,0000, et diviser par lui rendait des rapports à huit chiffres.
  // On garde donc le plus grand des deux — le bruit mesuré, ou un seuil de
  // perception. 0,02 niveau de gris moyen et 0,05 de gradient sont EN DESSOUS
  // de ce qu'un écran montre : ce qui les dépasse n'est pas forcément visible,
  // mais ce qui ne les atteint pas n'a rien écrit du tout.
  const PLANCHER_ABS_MOY = 0.02
  const PLANCHER_ABS_GRAD = 0.05
  let PM = Math.max(rapport.plancher.moy.max, PLANCHER_ABS_MOY)
  let PG = Math.max(rapport.plancher.grad.max, PLANCHER_ABS_GRAD)

  const LENTS = /photo aérienne|opacité de la photo|fondu à la côte|détail|échelle du détail|segments|socle|isoler|mer animée|rivières|villes|sommets|picker|maillage|ombres|continu|tranche/i
  const attente = (c) => (LENTS.test(c.nom + ' ' + c.section) ? Math.max(REPOS_MS, 2800) : REPOS_MS)

  const cible = controles.filter((c) => !FILTRE || (c.panneau + '|' + c.section + '|' + c.nom).toLowerCase().includes(FILTRE.toLowerCase()))
  const bouge = (idx, ph) => page.evaluate((i, p) => {
    try { return { pose: String(window.__r18.cibles[i].apply(p)) } } catch (er) { return { err: String(er.message).slice(0, 120) } }
  }, idx, ph)

  let rechargements = 0
  for (const c of cible) {
    const t0 = Date.now()
    const w = attente(c)
    const ligne = { ...c }
    let sale = false
    try {
      await releve('avant')
      const p0 = await bouge(c.i, 0)
      await dodo(w)
      await releve('a')
      const p1 = await bouge(c.i, 1)
      await dodo(w)
      await releve('b')
      await bouge(c.i, 2)
      await dodo(w)
      await releve('apres')

      const dA = await dist('avant', 'a')
      const dB = await dist('avant', 'b')
      const dAB = await dist('a', 'b')
      const dR = await dist('avant', 'apres')
      ligne.pose = [p0.pose ?? p0.err, p1.pose ?? p1.err]
      ligne.moy = Math.max(dA.moy, dB.moy, dAB.moy)
      ligne.grad = Math.max(dA.grad, dB.grad, dAB.grad)
      ligne.dRetour = { moy: dR.moy, grad: dR.grad }
      // ⚡ DEUX GRANDEURS, ON GARDE LA PLUS FORTE : la moyenne voit un
      // changement de couleur, le gradient voit un changement de MOTIF. Une
      // option n'a besoin que de l'une des deux pour être visible à l'œil.
      ligne.rMoy = ligne.moy / PM
      ligne.rGrad = ligne.grad / PG
      ligne.rapportPlancher = Math.max(ligne.rMoy, ligne.rGrad)
      ligne.dessins = await page.evaluate(() => window.__r18.slots.a?.dessins ?? null)
      sale = dR.moy > 3 * PM || dR.grad > 3 * PG
      if (CAPTURES && ligne.rapportPlancher > 4) {
        const nom = `${c.i}-${c.panneau}-${c.nom}`.replace(/[^\wÀ-ɏ-]+/g, '_').slice(0, 70)
        await bouge(c.i, 1)
        await dodo(w)
        await page.screenshot({ path: path.join(SORTIE, 'cap-' + nom + '.png') })
        sale = true
      }
    } catch (er) {
      ligne.err = String(er.message).slice(0, 160)
      sale = true
    }
    ligne.ms = Date.now() - t0
    ligne.sale = sale
    rapport.lignes.push(ligne)
    console.log(`${String(rapport.lignes.length).padStart(3)}/${cible.length} [${c.i}] ${c.panneau} › ${c.section} › ${c.nom} [${c.type}] moy=${ligne.moy?.toFixed(3) ?? '?'} (${ligne.rMoy?.toFixed(1) ?? '?'}×) grad=${ligne.grad?.toFixed(3) ?? '?'} (${ligne.rGrad?.toFixed(1) ?? '?'}×)${sale ? ' ⟲' : ''}${ligne.err ? ' ERR ' + ligne.err : ''}`)
    if (sale) {
      rechargements++
      controles = await preparer()
      rapport.plancher = await mesurerPlancher()
      PM = Math.max(rapport.plancher.moy.max, PLANCHER_ABS_MOY)
      PG = Math.max(rapport.plancher.grad.max, PLANCHER_ABS_GRAD)
    }
  }
  rapport.rechargements = rechargements
  rapport.erreursPage = erreurs
} finally {

  await nav.close()
  const f = path.join(SORTIE, 'sonde-' + Date.now() + '.json')
  fs.writeFileSync(f, JSON.stringify(rapport, null, 1))
  console.log('écrit :', f)
}
