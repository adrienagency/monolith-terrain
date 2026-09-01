// SONDE R21 bis — L'APPOINT SUR LES PAROIS DU CROP, MESURÉ EN PLEINE RÉSOLUTION
//
// ⚠️ **LE PROBLÈME DE MESURE, ET IL EST RÉEL** : la paroi est une bande étroite
// au pied du bloc. Une moyenne sur l'image entière la noie — c'est exactement le
// défaut ① de l'inventaire (« une moyenne de boîte ANNULE un motif fin »), mais
// pris par l'autre bout : ici c'est la SURFACE de l'objet mesuré qui est petite.
//
// ⚡ **LA PARADE : ON NE CHERCHE PAS LA PAROI, ON LA FAIT SE DÉSIGNER.** Deux
// images au même instant, même page, même scène, appoint ALLUMÉ dans les deux :
//   · A — la paroi reçoit l'appoint (le code d'après) ;
//   · B — l'uniforme d'appoint de la SEULE paroi est remplacé par un vecteur nul
//     privé (le code d'avant, au bit près, sans recharger ni recompiler).
// **Tout pixel qui diffère entre A et B est un pixel de paroi**, par
// construction : rien d'autre ne change entre les deux. Le compte de ces pixels,
// leur boîte et leur écart moyen SUR EUX SEULS sont donc la mesure exacte de ce
// que la correction fait — sans masque à fabriquer et sans région à deviner.
//
// ⚠️ **ET UN TÉMOIN, PARCE QUE LA MÉTHODE DOIT SE PROUVER ELLE-MÊME** : appoint
// ÉTEINT, la même bascule A/B doit rendre **exactement zéro pixel**. Sinon
// l'instrument fabrique sa propre différence et rien de ce qu'il dit ne vaut.
//
// ⚠️ **PLEINE RÉSOLUTION, PAS DE CONDENSÉ.** 1 280 × 800, moyenne courante sur
// N images, tout le calcul dans la page (12 Mo d'accumulateur ; les faire
// traverser CDP coûterait plus que le rendu).
import fs from 'node:fs'
import path from 'node:path'
import { fileURLToPath } from 'node:url'

const RACINE = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..')
const args = process.argv.slice(2)
const opt = (n, d = null) => { const i = args.indexOf(n); return i >= 0 && args[i + 1] ? args[i + 1] : d }
const has = (n) => args.includes(n)
const PORT = Number(opt('--port', '5603'))
const SORTIE = opt('--sortie', path.join(RACINE, '.banc/R21bis'))
const IMAGES = Number(opt('--images', '6'))
const REPOS = Number(opt('--repos', '900'))
const INTENSITE = Number(opt('--intensite', '3'))
const VISIBLE = has('--visible')
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

// ══════════ L'INSTRUMENT PLEINE RÉSOLUTION ═════════════════════════════════
function poserInstrumentPlein() {
  const e = window.__exp
  if (!e) return 'pas de __exp'
  if (window.__pp && window.__pp.capturer) return 'déjà posé'
  const R = e.renderer
  const gl = R.getContext()
  const CV = R.domElement
  const W = CV.width
  const H = CV.height
  const px = new Uint8Array(W * H * 4)
  const etat = { W, H, n: 0, slots: {} }
  window.__pp = etat
  let acc = null
  let nAcc = 0
  function lire() {
    gl.bindFramebuffer(gl.FRAMEBUFFER, null)
    gl.readPixels(0, 0, W, H, gl.RGBA, gl.UNSIGNED_BYTE, px)
    R.resetState?.()
    if (!acc) acc = new Float32Array(W * H * 3)
    for (let i = 0, j = 0; i < W * H; i++) { acc[j++] += px[i * 4]; acc[j++] += px[i * 4 + 1]; acc[j++] += px[i * 4 + 2] }
    nAcc++
    etat.n++
  }
  function boucle() {
    try { lire() } catch (err) { etat.erreur = String(err).slice(0, 140) }
    requestAnimationFrame(boucle)
  }
  etat.vider = () => { acc = null; nAcc = 0; etat.n = 0 }
  etat.pret = (k) => nAcc >= k
  etat.capturer = (nom) => {
    const m = new Float32Array(W * H * 3)
    for (let i = 0; i < W * H * 3; i++) m[i] = acc[i] / nAcc
    etat.slots[nom] = m
    return nAcc
  }
  // ⚠️ **LE SEUIL EST À 1 NIVEAU DE GRIS CUMULÉ SUR LES TROIS CANAUX**, pas à
  // zéro : la moyenne de N images est un flottant, et deux rendus identiques au
  // bit près y laissent des 1e-14. Un pixel « changé » est un pixel qu'un écran
  // pourrait montrer.
  etat.comparer = (a, b, seuil) => {
    const A = etat.slots[a]
    const B = etat.slots[b]
    if (!A || !B) return null
    const S = seuil ?? 1
    let somme = 0
    let n = 0
    let sommeSurChanges = 0
    let pire = 0
    let xmin = 1e9
    let xmax = -1
    let ymin = 1e9
    let ymax = -1
    let sx = 0
    let sy = 0
    for (let y = 0; y < H; y++) {
      for (let x = 0; x < W; x++) {
        const j = (y * W + x) * 3
        const d = Math.abs(A[j] - B[j]) + Math.abs(A[j + 1] - B[j + 1]) + Math.abs(A[j + 2] - B[j + 2])
        somme += d / 3
        if (d > pire) pire = d
        if (d > S) {
          n++
          sommeSurChanges += d / 3
          sx += x
          sy += y
          if (x < xmin) xmin = x
          if (x > xmax) xmax = x
          if (y < ymin) ymin = y
          if (y > ymax) ymax = y
        }
      }
    }
    // le GRADIENT, sur la luminance, comme le banc R18/R21 — il voit un MOTIF là
    // où la moyenne ne voit qu'une couleur
    const grad = (M) => {
      const g = new Float32Array(W * H)
      for (let y = 0; y < H; y++) {
        for (let x = 0; x < W; x++) {
          const i = y * W + x
          const j = i * 3
          const l = 0.299 * M[j] + 0.587 * M[j + 1] + 0.114 * M[j + 2]
          const lx = x + 1 < W ? 0.299 * M[j + 3] + 0.587 * M[j + 4] + 0.114 * M[j + 5] : l
          const k = j + W * 3
          const ly = y + 1 < H ? 0.299 * M[k] + 0.587 * M[k + 1] + 0.114 * M[k + 2] : l
          g[i] = Math.abs(lx - l) + Math.abs(ly - l)
        }
      }
      return g
    }
    const ga = grad(A)
    const gb = grad(B)
    let sg = 0
    for (let i = 0; i < W * H; i++) sg += Math.abs(ga[i] - gb[i])
    return {
      moyImage: somme / (W * H),
      gradImage: sg / (W * H),
      pire,
      pixels: n,
      partImage: n / (W * H),
      moySurPixelsChanges: n ? sommeSurChanges / n : 0,
      centre: n ? [Math.round(sx / n), Math.round(sy / n)] : null,
      boite: n ? [xmin, ymin, xmax, ymax] : null,
      taille: [W, H],
    }
  }
  requestAnimationFrame(boucle)
  return 'posé'
}

// ⚡ LA BASCULE : on remplace le PORTEUR de l'uniforme sur le seul matériau de
// paroi par un vecteur nul PRIVÉ. `three` lit `material.uniforms[nom].value` à
// chaque image : le partage est donc rompu pour la paroi et pour elle seule, et
// le reste de la scène garde l'appoint. Rien n'est recompilé (le programme est
// le même, seule la valeur change), rien n'est rechargé.
const COUPER_PAROI = () => {
  const m = window.__exp.globe?._parois?.material
  if (!m) return 'pas de paroi'
  if (!m.uniforms.uAppointIrr) return 'pas d uniforme d appoint sur la paroi'
  window.__paroiPartage = m.uniforms.uAppointIrr
  m.uniforms.uAppointIrr = { value: m.uniforms.uAppointIrr.value.clone().set(0, 0, 0) }
  return 'coupe'
}
const RENDRE_PAROI = () => {
  const m = window.__exp.globe?._parois?.material
  if (!m || !window.__paroiPartage) return 'rien a rendre'
  m.uniforms.uAppointIrr = window.__paroiPartage
  return 'rendu'
}

const puppeteer = await chargerPuppeteer()
const nav = await puppeteer.launch({
  executablePath: trouverChrome(),
  headless: !VISIBLE,
  args: [...(VISIBLE ? [] : ['--headless=new']), '--no-sandbox', '--enable-unsafe-swiftshader', '--window-size=1280,900'],
})
fs.mkdirSync(SORTIE, { recursive: true })
const rapport = { port: PORT, images: IMAGES, intensite: INTENSITE, mesures: [] }

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
  await page.evaluate(poserInstrumentPlein)
  await page.evaluate(() => { window.__exp.params.animations = false })
  // ⛔ **TROISIÈME COPIE DE LA MÊME PORTE FAUSSE — corrigée par R26.** Le brief
  // de R26 n'en annonçait que deux ; un `grep` sur la formule en a rendu trois.
  // C'est l'argument de la définition unique, en une ligne : une formule recopiée
  // se corrige autant de fois qu'elle a été recopiée, et on en oublie une.
  // `state === 'loading' || state === 'empty'` à zéro ne peut PAS arriver — il
  // reste 4 à 9 `empty` périmées que plus personne ne demande. Cette attente
  // expirait donc à ses 45 s, à chaque chargement.
  await page.waitForFunction(() => {
    const g = window.__exp.globe
    return !g || g.tuilesEnVol() === 0
  }, { polling: 250, timeout: 45000 }).catch(() => {})
  await dodo(4000)

  const releve = async (nom) => {
    await page.evaluate(() => window.__pp.vider())
    await page.waitForFunction((n) => window.__pp.pret(n), { polling: 30, timeout: 60000 }, IMAGES)
    return page.evaluate((n) => window.__pp.capturer(n), nom)
  }
  const comparer = (a, b) => page.evaluate((x, y) => window.__pp.comparer(x, y, 1), a, b)
  const machine = () => page.evaluate(() => {
    const e = window.__exp
    const P = window.__palierMachine || {}
    return {
      palier: P.palier, palierNom: P.nom, ombres: P.ombres, ombresRes: P.ombresRes,
      densite: P.densite, ecranPalier: P.signaux?.ecran,
      pixelRatio: e.renderer.getPixelRatio(), canvas: [e.renderer.domElement.width, e.renderer.domElement.height],
      mode: e.modes.mode, altM: +e.modes.altM.toFixed(1),
      paroiPresente: !!e.globe?._parois,
      paroiVisible: !!e.globe?._parois?.visible,
      uEclairageOn: e.globe.uniforms.uEclairageOn.value,
      uAppointIrrGlobal: [e.globe.uniforms.uAppointIrr.value.x, e.globe.uniforms.uAppointIrr.value.y, e.globe.uniforms.uAppointIrr.value.z].map((x) => +x.toFixed(4)),
      uAppointIrrParoi: (() => {
        const m = e.globe?._parois?.material
        if (!m?.uniforms?.uAppointIrr) return 'absent'
        const v = m.uniforms.uAppointIrr.value
        return [v.x, v.y, v.z].map((x) => +x.toFixed(4))
      })(),
      // ⛔ RÈGLE R22 : la couleur de la tranche se lit sur le MATÉRIAU
      uColParoi: (() => { const m = e.globe?._parois?.material; return m?.uniforms?.uCol?.value?.getHexString?.() ?? null })(),
      fill: (() => { const f = e.scene.children.find((c) => c.isDirectionalLight && !c.castShadow); return f ? { i: +f.intensity.toFixed(4), c: f.color.getHexString() } : null })(),
    }
  })

  rapport.gpu = await page.evaluate(() => {
    const gl = window.__exp?.renderer?.getContext?.()
    const d = gl?.getExtension('WEBGL_debug_renderer_info')
    return d ? String(gl.getParameter(d.UNMASKED_RENDERER_WEBGL)) : 'inconnu'
  })
  console.log('pilote :', rapport.gpu)

  // ══════ ① LE TÉMOIN — appoint ÉTEINT, la bascule ne doit RIEN changer ═════
  //
  // ⚠️ **IL PASSE EN PREMIER, ET C'EST DÉLIBÉRÉ.** Un instrument qui fabrique sa
  // propre différence rendrait la mesure suivante ininterprétable, et on ne le
  // saurait qu'après. `lecons-campagne-R.md` §③ : sans témoin, l'arbitre
  // condamnait un collègue à tort.
  const mesurer = async (nom) => {
    const av = await machine()
    await releve('A')
    const c1 = await page.evaluate(COUPER_PAROI)
    await dodo(REPOS)
    await releve('B')
    const pendant = await machine()
    const d = await comparer('A', 'B')
    const c2 = await page.evaluate(RENDRE_PAROI)
    await dodo(REPOS)
    await releve('C')
    const retour = await comparer('A', 'C')
    const ligne = { nom, bascule: [c1, c2], machine: av, machinePendant: pendant, d, retour }
    rapport.mesures.push(ligne)
    console.log(
      '[' + nom + '] pixels de paroi = ' + d.pixels + ' (' + (d.partImage * 100).toFixed(3) + ' % de l image)'
      + ' · ecart moyen SUR EUX = ' + d.moySurPixelsChanges.toFixed(2) + '/255'
      + ' · sur l image entiere = ' + d.moyImage.toFixed(4) + ' / grad ' + d.gradImage.toFixed(4)
      + ' · pire = ' + d.pire.toFixed(1)
      + ' · boite = ' + JSON.stringify(d.boite) + ' centre = ' + JSON.stringify(d.centre)
    )
    console.log('     retour A/C : ' + retour.pixels + ' pixel(s), moy ' + retour.moyImage.toFixed(6)
      + ' | palier ' + av.palier + ' ' + av.palierNom + ' ombres=' + av.ombres + ' ' + av.ombresRes
      + ' | pixelRatio ' + av.pixelRatio + ' canvas ' + JSON.stringify(av.canvas)
      + ' | appoint global ' + JSON.stringify(av.uAppointIrrGlobal) + ' paroi ' + JSON.stringify(av.uAppointIrrParoi)
      + ' | uCol ' + av.uColParoi)
    return ligne
  }

  await mesurer('temoin-appoint-eteint')

  // ══════ ② LA MESURE — appoint ALLUMÉ ═════════════════════════════════════
  // ⚠️ **PAR LES VRAIS CONTRÔLES DU DOM, PAS PAR UNE FONCTION INTERNE.** C'est la
  // règle du banc R18 — « aucune recopie du corps de `set:` : c'est le chemin de
  // l'utilisateur, ou rien ». Et `placeSun` n'est de toute façon pas exposé.
  const nomDe = `(r) => { const lab = r.querySelector('.ce-label'); return lab ? [...lab.childNodes].filter((x) => x.nodeType === 3).map((x) => x.textContent).join('').trim() : '' }`
  const allumerAppoint = () => page.evaluate((src) => {
    const nom = eval(src)
    for (const r of document.querySelectorAll('.ce-row')) {
      const t = r.querySelector('button.ce-toggle')
      if (t && nom(r) === 'Appoint' && !t.classList.contains('on')) t.click()
    }
    return { fillEnabled: window.__exp.params.fillEnabled, fillIntensity: window.__exp.params.fillIntensity }
  }, nomDe)
  const poserIntensite = (v) => page.evaluate((src, val) => {
    const nom = eval(src)
    for (const r of document.querySelectorAll('.ce-row')) {
      if (nom(r) !== 'Intensité') continue
      const rng = r.querySelector('input[type=range]')
      if (!rng) continue
      // ⚠️ la section « Lumière » et d'autres portent une ligne « Intensité » :
      // on ne garde que celle dont la plage est celle de l'appoint (0 à 3) et
      // qui vit dans le panneau des Éléments.
      if (rng.max !== '3') continue
      rng.value = String(val)
      rng.dispatchEvent(new Event('input', { bubbles: true }))
      rng.dispatchEvent(new Event('change', { bubbles: true }))
    }
    return window.__exp.params.fillIntensity
  }, nomDe, v)

  console.log('appoint allume :', JSON.stringify(await allumerAppoint()))
  await dodo(2000)
  console.log('intensite posee :', await poserIntensite(INTENSITE))
  await dodo(2500)
  await mesurer('appoint-allume-' + INTENSITE)

  console.log('intensite posee :', await poserIntensite(0.6))
  await dodo(2500)
  await mesurer('appoint-allume-0.6')

  await page.screenshot({ path: path.join(SORTIE, 'paroi-appoint-allume.png') })
  await page.evaluate(COUPER_PAROI)
  await dodo(REPOS)
  await page.screenshot({ path: path.join(SORTIE, 'paroi-appoint-coupe.png') })
  await page.evaluate(RENDRE_PAROI)

  rapport.erreursPage = erreurs
  const f = path.join(SORTIE, 'paroi.json')
  fs.writeFileSync(f, JSON.stringify(rapport, null, 1))
  console.log('ecrit :', f)
} finally { await nav.close() }
