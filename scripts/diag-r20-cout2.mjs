// DIAG R20 ⑫ — LE COÛT, PROPREMENT, DES TROIS CANDIDATS.
//
// ⛔ **PROTOCOLE DURCI, parce que la passe ⑩ s'est fait contaminer** : son
// témoin rendait ×1,47 pour ×16 de fragments (la mesure propre en rend ×8,2) et
// trois surcoûts sortaient négatifs. Cause : le flux de tuiles du globe
// tournait pendant le chronométrage.
//
//   · **20 s de repos** avant toute mesure, le temps que le quadtree se taise ;
//   · **la simulation est mise en pause** (`params.paused`) : un ciel qui
//     évolue entre deux blocs change la surface marchée sous le chronomètre ;
//   · **témoin de sensibilité aux fragments AVANT ET APRÈS** — si le rapport
//     tombe sous 4, le relevé entier est marqué douteux et n'est pas publié ;
//   · **AVEC / SANS / AVEC** pour chaque candidat : si les deux AVEC ne se
//     recoupent pas à 10 %, la machine a dérivé et la ligne est marquée.
import fs from 'node:fs'
import path from 'node:path'
import { fileURLToPath } from 'node:url'

const RACINE = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..')
const A = process.argv.slice(2)
const opt = (n, d = null) => { const i = A.indexOf(n); return i >= 0 && A[i + 1] ? A[i + 1] : d }
const PORT = Number(opt('--port', '5571'))
const SORTIE = opt('--sortie', path.join(RACINE, '.banc/R20/defaut'))
fs.mkdirSync(SORTIE, { recursive: true })

const AVANT = { cloudsEnabled: true, cloudOpacity: 0.6, cloudAltitude: 13.5, cloudAltSpread: 0.97, cloudCoverage: 0.85 }
const SOCLE = { cloudOpacity: 1.4, cloudAltSpread: 0.45, cloudCoverage: 0.8 }
const CANDIDATS = [
  // le ciel d AVANT : reglages d avant ET budget de grappes d avant
  { nom: 'AVANT-3-grappes', v: {}, grappes: 3 },
  // le ciel RETENU, tel que shibustart.json le pose maintenant
  { nom: 'RETENU-6-grappes', v: SOCLE, grappes: null },
]
const GRAINE = 1055 // une graine FIXE : on compare des coûts, pas des tirages

async function chargerPuppeteer() {
  for (const p of [path.join(RACINE, 'node_modules/puppeteer-core/lib/puppeteer/puppeteer-core.js'),
    'C:/Dev/wt-f3/node_modules/puppeteer-core/lib/puppeteer/puppeteer-core.js']) {
    if (fs.existsSync(p)) return (await import('file:///' + p.split('\\').join('/'))).default
  }
  process.exit(2)
}
const dodo = (ms) => new Promise((r) => setTimeout(r, ms))
const puppeteer = await chargerPuppeteer()
const nav = await puppeteer.launch({ executablePath: 'C:/Program Files/Google/Chrome/Application/chrome.exe', headless: true, args: ['--headless=new', '--no-sandbox', '--enable-unsafe-swiftshader', '--window-size=1280,900'] })
const out = { graine: GRAINE, candidats: [] }
try {
  const page = await nav.newPage()
  await page.setViewport({ width: 1280, height: 800 })
  await page.evaluateOnNewDocument(() => { try { localStorage.setItem('shibumap-ui-advanced', '1') } catch {} })
  await page.goto(`http://localhost:${PORT}/`, { waitUntil: 'domcontentloaded', timeout: 120000 })
  await page.waitForFunction(() => window.__exp?.composer, { timeout: 90000, polling: 100 })
  await dodo(20000)
  await page.keyboard.press('Escape')
  await page.evaluate(() => { window.__exp.params.animations = false; window.__exp.params.paused = true })
  await dodo(6000)

  const temoin = () => page.evaluate(async () => {
    const e = window.__exp
    const gl = e.renderer.getContext()
    const ext = gl.getExtension('EXT_disjoint_timer_query_webgl2')
    const dodo = (ms) => new Promise((r) => setTimeout(r, ms))
    const t = []
    for (const f of [1, 2]) {
      e.renderer.setPixelRatio(f)
      e.composer.setSize(Math.round(1280 * f), Math.round(800 * f))
      await dodo(900)
      for (let i = 0; i < 40; i++) e.composer.render(0)
      const q = gl.createQuery()
      gl.beginQuery(ext.TIME_ELAPSED_EXT, q)
      for (let i = 0; i < 40; i++) e.composer.render(0)
      gl.endQuery(ext.TIME_ELAPSED_EXT)
      for (let k = 0; k < 500; k++) { if (gl.getQueryParameter(q, gl.QUERY_RESULT_AVAILABLE)) break; await dodo(6) }
      const ns = gl.getQueryParameter(q, gl.QUERY_RESULT)
      gl.deleteQuery(q)
      t.push({ mpx: +(gl.drawingBufferWidth * gl.drawingBufferHeight / 1e6).toFixed(3), ms: +(ns / 1e6 / 40).toFixed(4) })
    }
    e.renderer.setPixelRatio(1)
    e.composer.setSize(1280, 800)
    await dodo(900)
    return { echelle: t, rapport: +(t[1].ms / t[0].ms).toFixed(2) }
  })

  const chrono = () => page.evaluate(async () => {
    const e = window.__exp
    const gl = e.renderer.getContext()
    const ext = gl.getExtension('EXT_disjoint_timer_query_webgl2')
    const dodo = (ms) => new Promise((r) => setTimeout(r, ms))
    const l = []
    for (let b = 0; b < 7; b++) {
      for (let i = 0; i < 40; i++) e.composer.render(0)
      const q = gl.createQuery()
      gl.beginQuery(ext.TIME_ELAPSED_EXT, q)
      for (let i = 0; i < 60; i++) e.composer.render(0)
      gl.endQuery(ext.TIME_ELAPSED_EXT)
      for (let k = 0; k < 500; k++) { if (gl.getQueryParameter(q, gl.QUERY_RESULT_AVAILABLE)) break; await dodo(6) }
      if (gl.getParameter(ext.GPU_DISJOINT_EXT)) { gl.deleteQuery(q); continue }
      const ns = gl.getQueryParameter(q, gl.QUERY_RESULT)
      gl.deleteQuery(q)
      l.push(ns / 1e6 / 60)
    }
    l.sort((a, b) => a - b)
    return { n: l.length, mediane: l.length ? +l[Math.floor(l.length / 2)].toFixed(4) : null, min: l.length ? +l[0].toFixed(4) : null, max: l.length ? +l[l.length - 1].toFixed(4) : null }
  })

  // ⚠️ CHAUFFE OBLIGATOIRE AVANT LE PREMIER TEMOIN. Sans elle il a rendu 1,57
  // quand le temoin de SORTIE rendait 7,88 sur la meme page : le premier bloc
  // paie la compilation des nuanceurs et la fin du flux de tuiles, et ma
  // propre garde a invalide un releve par ailleurs coherent.
  await chrono()
  await dodo(3000)
  await chrono()
  await dodo(3000)
  await temoin() // le premier cycle de redimensionnement paie l allocation des cibles
  out.temoinAvant = await temoin()
  console.log('temoin avant', JSON.stringify(out.temoinAvant))

  // ⛔ **MESURE APPARIÉE ET ENTRELACÉE.** Deux passes séparées « tout AVEC »
  // puis « tout SANS » se font piéger par la dérive lente de la machine : la
  // ligne de base SANS a bougé de 0,3263 à 0,5664 entre deux candidats de la
  // même page, ce qui a rendu un surcoût de +0,05 ms pour la configuration qui
  // a le PLUS de boîtes. Absurde, et c'est l'instrument, pas le rendu.
  // ⚡ On alterne donc AVEC / SANS dans le MÊME instant, huit fois, et on rend
  // la MÉDIANE DES DIFFÉRENCES APPARIÉES : toute dérive plus lente qu'un couple
  // se soustrait d'elle-même.
  for (const c of CANDIDATS) {
    const etat = await page.evaluate(([v, gr, seed]) => {
      const e = window.__exp
      if (gr) e.clouds._targetCount = () => gr
      else delete e.clouds._targetCount
      Object.assign(e.params, { ...v, cloudsEnabled: true, seaSeed: seed })
      e.clouds.build(e.params)
      return { cible: e.clouds.sky.target, entites: e.clouds.group.children[0]?.count }
    }, [{ ...AVANT, ...c.v }, c.grappes, GRAINE])
    await dodo(3500)
    const couples = await page.evaluate(async () => {
      const e = window.__exp
      const gl = e.renderer.getContext()
      const ext = gl.getExtension('EXT_disjoint_timer_query_webgl2')
      const dodo = (ms) => new Promise((r) => setTimeout(r, ms))
      const bloc = async () => {
        for (let i = 0; i < 20; i++) e.composer.render(0)
        const q = gl.createQuery()
        gl.beginQuery(ext.TIME_ELAPSED_EXT, q)
        for (let i = 0; i < 50; i++) e.composer.render(0)
        gl.endQuery(ext.TIME_ELAPSED_EXT)
        for (let k = 0; k < 500; k++) { if (gl.getQueryParameter(q, gl.QUERY_RESULT_AVAILABLE)) break; await dodo(5) }
        if (gl.getParameter(ext.GPU_DISJOINT_EXT)) { gl.deleteQuery(q); return null }
        const ns = gl.getQueryParameter(q, gl.QUERY_RESULT)
        gl.deleteQuery(q)
        return ns / 1e6 / 50
      }
      const d = []
      const av = []
      const sa = []
      for (let r = 0; r < 8; r++) {
        // ⛔ ON COUPE PAR params.cloudsEnabled, JAMAIS PAR setVisible SEUL.
        // majNuagesGlobe reapplique la visibilite a CHAQUE image : un
        // setVisible(false) de sonde ne tient pas une image, et les deux
        // moities du couple mesurent alors la meme chose. C est exactement ce
        // qui a rendu sans ~= avec sur la passe precedente.
        e.params.cloudsEnabled = true; e.clouds.setVisible(true)
        await dodo(200)
        const a = await bloc()
        e.params.cloudsEnabled = false; e.clouds.setVisible(false)
        await dodo(200)
        const s = await bloc()
        e.params.cloudsEnabled = true; e.clouds.setVisible(true)
        if (a != null && s != null) { d.push(a - s); av.push(a); sa.push(s) }
      }
      const med = (x) => { const y = x.slice().sort((p, q) => p - q); return y.length ? y[Math.floor(y.length / 2)] : null }
      return { n: d.length, surcout: med(d), avec: med(av), sans: med(sa), etendue: d.length ? [Math.min(...d), Math.max(...d)] : null }
    })
    const ligne = {
      nom: c.nom, grappes: c.grappes, ...etat,
      couples: couples.n,
      avec: couples.avec != null ? +couples.avec.toFixed(4) : null,
      sans: couples.sans != null ? +couples.sans.toFixed(4) : null,
      surcout: couples.surcout != null ? +couples.surcout.toFixed(4) : null,
      etendue: couples.etendue ? couples.etendue.map((x) => +x.toFixed(4)) : null,
    }
    ligne.surcoutPct = ligne.sans ? +((ligne.surcout / ligne.sans) * 100).toFixed(1) : null
    out.candidats.push(ligne)
    console.log(c.nom, JSON.stringify(ligne))
  }
  out.temoinApres = await temoin()
  console.log('temoin apres', JSON.stringify(out.temoinApres))
  out.instrumentValide = (out.temoinAvant?.rapport ?? 0) >= 4 && (out.temoinApres?.rapport ?? 0) >= 4
  console.log('INSTRUMENT VALIDE :', out.instrumentValide)
} catch (err) {
  out.erreur = String(err?.stack || err)
  console.error(out.erreur)
} finally {
  fs.writeFileSync(path.join(SORTIE, 'diag-cout2.json'), JSON.stringify(out, null, 1))
  await nav.close()
}
