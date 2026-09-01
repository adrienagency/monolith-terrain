// DIAG R25 — LE COÛT EN TEMPS GPU, MINUTERIE DU PILOTE, AUX DEUX ALTITUDES.
//
// ⛔ **`gl.finish()` NE PÈSE PAS LES FRAGMENTS** — un rapport de ce chantier a
// été réfuté là-dessus. On emploie `EXT_disjoint_timer_query_webgl2`, et on le
// fait précéder ET suivre d'un **témoin de validité** : multiplier les fragments
// par 4 (pixelRatio 1 → 2) doit multiplier le temps. R20 a mesuré ×4 ⇒ ×8,2 avec
// la bonne minuterie contre ×0,96 avec un banc CPU. Sous un rapport de 2, le
// relevé entier est marqué douteux.
//
// Deux mesures, deux questions :
//   --volet transmission  → CE QUE COÛTERAIT LE VERRE : une passe de rendu de la
//                           scène ENTIÈRE en plus, ce qu'est exactement le
//                           `transmissionRenderTarget` de three. Mesurée AVANT
//                           de porter quoi que ce soit (consigne du brief).
//   --volet matiere       → le surcoût du nuanceur de matière (uMatOn 0 vs 1).
import fs from 'node:fs'
import path from 'node:path'
import { fileURLToPath } from 'node:url'

const RACINE = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..')
const A = process.argv.slice(2)
const opt = (n, d = null) => { const i = A.indexOf(n); return i >= 0 && A[i + 1] ? A[i + 1] : d }
const PORT = Number(opt('--port', '5611'))
const VOLET = opt('--volet', 'transmission')
const SORTIE = opt('--sortie', path.join(RACINE, '.banc/R25'))
fs.mkdirSync(SORTIE, { recursive: true })

async function chargerPuppeteer() {
  for (const p of [path.join(RACINE, 'node_modules/puppeteer-core/lib/puppeteer/puppeteer-core.js'),
    'C:/Dev/wt-f3/node_modules/puppeteer-core/lib/puppeteer/puppeteer-core.js']) {
    if (fs.existsSync(p)) return (await import('file:///' + p.split('\\').join('/'))).default
  }
  console.error('puppeteer-core introuvable'); process.exit(2)
}
const dodo = (ms) => new Promise((r) => setTimeout(r, ms))
const puppeteer = await chargerPuppeteer()
const nav = await puppeteer.launch({
  executablePath: 'C:/Program Files/Google/Chrome/Application/chrome.exe',
  headless: true,
  args: ['--headless=new', '--no-sandbox', '--enable-unsafe-swiftshader', '--window-size=1280,900'],
})
const out = { volet: VOLET, quand: new Date().toISOString(), altitudes: [] }
try {
  const page = await nav.newPage()
  await page.setViewport({ width: 1280, height: 800 })
  await page.evaluateOnNewDocument(() => { try { localStorage.setItem('shibumap-ui-advanced', '1') } catch {} })
  await page.goto(`http://localhost:${PORT}/`, { waitUntil: 'domcontentloaded', timeout: 180000 })
  await page.waitForFunction(() => window.__exp?.composer, { timeout: 180000, polling: 200 })
  // ⚠️ 22 s de repos : le flux de tuiles du globe contamine tout chronométrage
  // pris pendant qu'il tourne (protocole durci de R20 ⑫).
  await dodo(22000)
  await page.keyboard.press('Escape')
  await page.evaluate(() => { const e = window.__exp; e.params.animations = false; e.params.paused = true })
  await dodo(6000)

  out.palier = await page.evaluate(() => {
    const p = window.__palierMachine
    return p ? { ombres: p.reglages?.ombres ?? null, grain: p.reglages?.grain ?? null, nuages: p.reglages?.nuages ?? null, dof: p.reglages?.dof ?? null, ecran: p.signaux?.ecran ?? null } : null
  })
  out.gl = await page.evaluate(() => {
    const gl = window.__exp.renderer.getContext()
    return {
      unitesTexture: gl.getParameter(gl.MAX_TEXTURE_IMAGE_UNITS),
      unitesCombinees: gl.getParameter(gl.MAX_COMBINED_TEXTURE_IMAGE_UNITS),
      rendu: (() => { const d = gl.getExtension('WEBGL_debug_renderer_info'); return d ? gl.getParameter(d.UNMASKED_RENDERER_WEBGL) : null })(),
      minuterie: !!gl.getExtension('EXT_disjoint_timer_query_webgl2'),
    }
  })

  await page.evaluate(() => {
    // le chronomètre partagé, posé une fois dans la page
    const e = window.__exp
    const gl = e.renderer.getContext()
    const ext = gl.getExtension('EXT_disjoint_timer_query_webgl2')
    const dodo = (ms) => new Promise((r) => setTimeout(r, ms))
    window.__r25 = {
      gl, ext, dodo,
      async pese(rendre, blocs = 7, parBloc = 60) {
        const l = []
        for (let b = 0; b < blocs; b++) {
          for (let i = 0; i < 30; i++) rendre()
          const q = gl.createQuery()
          gl.beginQuery(ext.TIME_ELAPSED_EXT, q)
          for (let i = 0; i < parBloc; i++) rendre()
          gl.endQuery(ext.TIME_ELAPSED_EXT)
          for (let k = 0; k < 800; k++) { if (gl.getQueryParameter(q, gl.QUERY_RESULT_AVAILABLE)) break; await dodo(5) }
          if (gl.getParameter(ext.GPU_DISJOINT_EXT)) { gl.deleteQuery(q); continue }
          const ns = gl.getQueryParameter(q, gl.QUERY_RESULT)
          gl.deleteQuery(q)
          l.push(ns / 1e6 / parBloc)
        }
        l.sort((a, b) => a - b)
        return { n: l.length, med: l.length ? +l[Math.floor(l.length / 2)].toFixed(4) : null, min: l.length ? +l[0].toFixed(4) : null, max: l.length ? +l[l.length - 1].toFixed(4) : null }
      },
    }
  })

  // ⚠️ LE TÉMOIN DE VALIDITÉ : ×4 de fragments doit multiplier le temps.
  const temoin = () => page.evaluate(async () => {
    const e = window.__exp; const r = window.__r25; const t = []
    for (const f of [1, 2]) {
      e.renderer.setPixelRatio(f)
      e.composer.setSize(Math.round(1280 * f), Math.round(800 * f))
      await r.dodo(900)
      const m = await r.pese(() => e.composer.render(0), 3, 40)
      t.push({ facteur: f, mpx: +(r.gl.drawingBufferWidth * r.gl.drawingBufferHeight / 1e6).toFixed(3), ms: m.med })
    }
    e.renderer.setPixelRatio(1); e.composer.setSize(1280, 800); await r.dodo(900)
    return { echelle: t, rapport: +(t[1].ms / t[0].ms).toFixed(2), fragments: +(t[1].mpx / t[0].mpx).toFixed(2) }
  })

  const mesureTransmission = () => page.evaluate(async () => {
    const e = window.__exp; const r = window.__r25
    const THREE = e.THREE || window.THREE
    // La caméra ACTIVE du composeur : c'est elle que la passe de transmission
    // de three emploierait (`renderer.render(scene, camera)` dans
    // `WebGLRenderer.renderTransmissionPass`).
    const passe = e.composer.passes.find((p) => p.scene && p.camera)
    const scene = passe?.scene ?? e.scene
    const cam = passe?.camera ?? e.camera
    // three alloue la cible de transmission à la MOITIÉ de la taille du tampon
    // (`_transmissionRenderTarget`, r1xx : `getRenderTarget` demi-résolution)
    // — on pèse les DEUX, et on publie la moins favorable.
    const W = r.gl.drawingBufferWidth, H = r.gl.drawingBufferHeight
    // ⚠️ PAS DE CIBLE DE RENDU FABRIQUEE A LA MAIN : on rend la scene une fois
    // de plus dans le tampon courant. Ce qu'on pese est le TRAVAIL de la passe
    // (sommets + fragments de la Terre entiere), qui est exactement ce que
    // `renderTransmissionPass` soumet. Le demi-format est obtenu au CISEAU
    // (viewport + scissor), donc au quart des fragments — l'ordre de grandeur
    // de la cible demi-resolution de three.
    const rendreExtra = (demi) => {
      if (demi) {
        e.renderer.setScissorTest(true)
        e.renderer.setViewport(0, 0, Math.floor(W / 2), Math.floor(H / 2))
        e.renderer.setScissor(0, 0, Math.floor(W / 2), Math.floor(H / 2))
      }
      e.renderer.render(scene, cam)
      if (demi) {
        e.renderer.setScissorTest(false)
        e.renderer.setViewport(0, 0, W, H)
        e.renderer.setScissor(0, 0, W, H)
      }
    }
    const base = await r.pese(() => e.composer.render(0))
    const avecDemi = await r.pese(() => { e.composer.render(0); rendreExtra(true) })
    const avecPlein = await r.pese(() => { e.composer.render(0); rendreExtra(false) })
    const base2 = await r.pese(() => e.composer.render(0))
    return {
      base, base2, avecDemi, avecPlein,
      tampon: [W, H],
      surcoutDemiMs: +(avecDemi.med - base.med).toFixed(4),
      surcoutPleinMs: +(avecPlein.med - base.med).toFixed(4),
      facteurDemi: +(avecDemi.med / base.med).toFixed(3),
      facteurPlein: +(avecPlein.med / base.med).toFixed(3),
      deriveBase: +(base2.med - base.med).toFixed(4),
    }
  })

  const mesureMatiere = () => page.evaluate(async () => {
    const e = window.__exp; const r = window.__r25
    const u = e.globe.uniforms
    if (!u.uMatOn) return { absent: true }
    const av = u.uMatOn.value
    const poser = (v) => { u.uMatOn.value = v }
    poser(0); const sans1 = await r.pese(() => e.composer.render(0))
    poser(1); const avec1 = await r.pese(() => e.composer.render(0))
    poser(0); const sans2 = await r.pese(() => e.composer.render(0))
    poser(1); const avec2 = await r.pese(() => e.composer.render(0))
    poser(av)
    const sans = Math.min(sans1.med, sans2.med), avec = Math.min(avec1.med, avec2.med)
    return {
      sans1, avec1, sans2, avec2,
      // ⚠️ on publie la valeur la MOINS favorable (leçon ① du dossier)
      surcoutMs: +(Math.max(avec1.med, avec2.med) - Math.min(sans1.med, sans2.med)).toFixed(4),
      surcoutMsFavorable: +(avec - sans).toFixed(4),
      facteur: +(Math.max(avec1.med, avec2.med) / Math.min(sans1.med, sans2.med)).toFixed(3),
      recoupementSans: +Math.abs(sans1.med - sans2.med).toFixed(4),
      recoupementAvec: +Math.abs(avec1.med - avec2.med).toFixed(4),
    }
  })

  // ⚠️ **UNE MATIÈRE VRAIMENT POSÉE, PAS `uMatOn` FORCÉ SUR UNE TEXTURE VIDE.**
  // Basculer l'uniforme sans matière aurait pesé un échantillonnage de la texture
  // vide de `three` (1 × 1), c'est-à-dire un accès toujours en cache — donc un
  // coût plancher, pas le coût réel. On CLIQUE la vignette, comme un doigt.
  if (VOLET === 'matiere') {
    await page.evaluate(() => {
      const picks = [...document.querySelectorAll('.ce-mat-pick')]
      const p = picks.find((n) => [...n.querySelectorAll('.ce-mat-vig')].some((b) => b.getAttribute('data-tip') === 'Verre'))
      const t = [...p.querySelectorAll('.ce-mat-vig')].find((b) => b.getAttribute('data-tip') === 'Roche brute')
      t.click()
    })
    await dodo(9000) // le temps que les trois JPEG arrivent et montent en VRAM
  }
  for (const alt of ['crop', 'orbite']) {
    if (alt === 'orbite') { await page.evaluate(() => window.__exp.modes.enterOrbit()); await dodo(16000) }
    const etat = await page.evaluate(() => {
      const e = window.__exp
      return { crop: !!e.globe?._crop, mode: e.modes?.mode ?? null, dist: +(e.controls?.getDistance?.() ?? 0).toFixed(2), mat: e.params.terrainSurfaceMat }
    })
    // chauffe obligatoire : le premier bloc paie la compilation et la fin du flux
    await page.evaluate(async () => { const e = window.__exp; await window.__r25.pese(() => e.composer.render(0), 2, 40) })
    await dodo(2500)
    const tAvant = await temoin()
    const m = VOLET === 'matiere' ? await mesureMatiere() : await mesureTransmission()
    const tApres = await temoin()
    const douteux = tAvant.rapport < 2 || tApres.rapport < 2
    out.altitudes.push({ alt, etat, temoinAvant: tAvant, temoinApres: tApres, douteux, mesure: m })
    console.log('---', alt, JSON.stringify(etat))
    console.log('  temoin', tAvant.rapport, '/', tApres.rapport, douteux ? '⛔ DOUTEUX' : '✅')
    console.log('  ', JSON.stringify(m))
  }
  const f = path.join(SORTIE, `cout-${VOLET}.json`)
  fs.writeFileSync(f, JSON.stringify(out, null, 2))
  console.log('→', f)
} finally {
  await nav.close()
}
